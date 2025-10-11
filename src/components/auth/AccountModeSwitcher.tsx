'use client';

import React from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useBaseAccount } from '@/providers/base-account-context';
import useSmartWallet from '@/hooks/useSmartWallet';
import type { AccountMode } from '@/cli/state/types';

interface AccountModeSwitcherProps {
  currentMode: AccountMode;
  onModeChange: (mode: AccountMode) => void;
}

export default function AccountModeSwitcher({ 
  currentMode, 
  onModeChange 
}: AccountModeSwitcherProps) {
  const { authenticated: privyAuth, user } = usePrivy();
  const { isConnected: baseAccountConnected } = useBaseAccount();
  const { smartWallet } = useSmartWallet();

  // Determine available modes
  const hasEOA = privyAuth && user?.linkedAccounts?.some(a => a.type === 'wallet');
  const hasSmartAccount = !!smartWallet;
  const hasBaseAccount = baseAccountConnected;

  const modes = [
    { key: 'EOA' as AccountMode, label: 'EOA', available: hasEOA },
    { key: 'SMART_ACCOUNT' as AccountMode, label: 'Smart Account', available: hasSmartAccount },
    { key: 'BASE_ACCOUNT' as AccountMode, label: 'Base Account', available: hasBaseAccount },
  ];

  const availableModes = modes.filter(m => m.available);

  if (availableModes.length <= 1) {
    return null; // Don't show switcher if only one option
  }

  return (
    <div className="flex gap-2 p-2 bg-gray-800 rounded-lg">
      {modes.map(mode => (
        <button
          key={mode.key}
          onClick={() => mode.available && onModeChange(mode.key)}
          disabled={!mode.available}
          className={`
            px-4 py-2 rounded text-sm font-medium transition-colors
            ${currentMode === mode.key 
              ? 'bg-blue-600 text-white' 
              : mode.available 
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                : 'bg-gray-900 text-gray-600 cursor-not-allowed'
            }
          `}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
