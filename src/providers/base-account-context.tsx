'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { usePrivy, useWallets, useBaseAccountSdk, useConnectWallet } from '@privy-io/react-auth';
import { getBaseAccountConfig } from '@/lib/config/base-account';

export interface BaseAccountContextValue {
  // Base Account wallet info
  baseAccountWallet: any | null;
  baseAccountAddress: string | null;
  isConnected: boolean;
  
  // SDK access
  sdk: any | null;
  provider: any | null;
  
  // Status
  isLoading: boolean;
  error: string | null;
  
  // Actions
  promptSetup: () => void;
  clearError: () => void;
}

const BaseAccountContext = createContext<BaseAccountContextValue | undefined>(undefined);

export function useBaseAccount() {
  const context = useContext(BaseAccountContext);
  if (!context) {
    throw new Error('useBaseAccount must be used within BaseAccountProvider');
  }
  return context;
}

interface BaseAccountProviderProps {
  children: React.ReactNode;
}

export function BaseAccountProvider({ children }: BaseAccountProviderProps) {
  const config = getBaseAccountConfig();
  const { ready: privyReady, authenticated: privyAuthenticated, login, user } = usePrivy();
  const { wallets } = useWallets();
  const { baseAccountSdk } = useBaseAccountSdk();
  const { connectWallet } = useConnectWallet();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Find Base Account wallet from Privy's wallets
  const baseAccountWallet = useMemo(() => {
    return wallets.find(wallet => wallet.walletClientType === 'base_account');
  }, [wallets]);

  // Derive connection state
  const isConnected = !!baseAccountWallet;
  const baseAccountAddress = baseAccountWallet?.address || null;

  // Get provider from SDK
  const provider = useMemo(() => {
    if (!baseAccountSdk) return null;
    try {
      return baseAccountSdk.getProvider();
    } catch (error) {
      console.error('Failed to get Base Account provider:', error);
      return null;
    }
  }, [baseAccountSdk]);

  // Auto-reconnect Base Account wallet if user logged in with it
  useEffect(() => {
    if (!config.enabled) return;
    if (!privyReady || !privyAuthenticated || !user) return;
    if (isConnected) return; // Already connected
    
    // Check if user has Base Account in Privy's linked accounts
    // Look for wallet type accounts that might be Base Account
    const hasBaseAccountLinked = user.linkedAccounts?.some(
      (account: any) => {
        // Base Account appears as a wallet in linkedAccounts
        if (account.type === 'wallet' && account.walletClientType === 'base_account') {
          return true;
        }
        // Also check for base_account type directly
        if (account.type === 'base_account') {
          return true;
        }
        return false;
      }
    );

    if (!hasBaseAccountLinked) {
      return;
    }

    // User has Base Account linked but it's not in wallets array
    // This happens after re-login - need to reconnect
    
    const attemptReconnect = async () => {
      try {
        setIsLoading(true);
        await connectWallet({
          walletList: ['base_account'],
        });
      } catch (error) {
        console.error('❌ Failed to reconnect Base Account:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Small delay to ensure Privy is fully initialized
    const timeout = setTimeout(attemptReconnect, 500);
    return () => clearTimeout(timeout);
  }, [config.enabled, privyReady, privyAuthenticated, user, isConnected, wallets.length, connectWallet]);

  // Show setup prompt for logged-in users without Base Account
  useEffect(() => {
    if (!config.enabled) return;
    if (!privyReady || !privyAuthenticated) {
      setError(null);
      return;
    }

    if (isConnected) {
      setError(null);
      return;
    }

    // Check if user declined
    const hasDeclined = localStorage.getItem('baseAccountDeclined') === 'true';
    if (hasDeclined) {
      setError(null);
      return;
    }

    // Show persistent setup prompt
    setError('Set up your Base Account to unlock passkey authentication, gas-free transactions, and seamless payments.');
  }, [config.enabled, privyReady, privyAuthenticated, isConnected]);

  // Auto-create attempt (if enabled)
  useEffect(() => {
    if (!config.autoCreate || !config.enabled) return;
    if (!privyReady || !privyAuthenticated) return;
    if (isConnected) return;

    // Check if already attempted
    const autoCreateAttempted = sessionStorage.getItem('baseAccountAutoCreateAttempted') === 'true';
    if (autoCreateAttempted) return;

    // Check if user declined
    const hasDeclined = localStorage.getItem('baseAccountDeclined') === 'true';
    if (hasDeclined) return;

    // Attempt to prompt Base Account setup through Privy
    const attemptSetup = async () => {
      try {
        sessionStorage.setItem('baseAccountAutoCreateAttempted', 'true');
        
        // Open Privy login with Base Account preselected
        // Note: User may already be logged in with different method
        // In that case, they need to manually add Base Account wallet
      } catch (error) {
        console.error('Auto-setup failed:', error);
      }
    };

    const timeout = setTimeout(attemptSetup, 1000);
    return () => clearTimeout(timeout);
  }, [config.autoCreate, config.enabled, privyReady, privyAuthenticated, isConnected]);

  // Prompt user to set up Base Account
  const promptSetup = () => {
    if (!privyAuthenticated) {
      // User not logged in - open Privy login with Base Account
      login();
    } else {
      // User already logged in with email/other method
      // Base Account requires re-authentication to properly link
      
      // Show explanation to user
      alert(
        'To use Base Account, you need to log in with it.\n\n' +
        'You will be logged out and can then choose "Base Account" as your login method.\n\n' +
        'Your account data will be preserved.'
      );
      
      // For now, open connectWallet (temporary connection for this session)
      // TODO: Consider implementing proper re-login flow
      connectWallet({
        walletList: ['base_account']
      });
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value: BaseAccountContextValue = {
    baseAccountWallet,
    baseAccountAddress,
    isConnected,
    sdk: baseAccountSdk || null,
    provider,
    isLoading,
    error,
    promptSetup,
    clearError,
  };

  return (
    <BaseAccountContext.Provider value={value}>
      {children}
    </BaseAccountContext.Provider>
  );
}
