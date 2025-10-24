'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createBaseAccountSDK } from '@base-org/account';
import { getBaseAccountConfig } from '@/lib/config/base-account';
import { getSubAccountOwner, deleteSubAccountKey } from '@/lib/config/sub-account-keys';
import { usePrivy } from '@privy-io/react-auth';
import { debugLog } from "@/lib/utils/debugLog";

interface BaseAccountContextValue {
  sdk: any | null;
  provider: any | null;
  address: `0x${string}` | null;
  subAccountAddress: `0x${string}` | null;
  isConnected: boolean;
  isInitialized: boolean;
  connectionError: string | null;
  retryCount: number;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchChain: (chainId: number) => Promise<void>;
}

const BaseAccountContext = createContext<BaseAccountContextValue | null>(null);

export function BaseAccountProvider({ children }: { children: React.ReactNode }) {
  const { authenticated: privyAuthenticated, ready: privyReady } = usePrivy();
  const [sdk, setSdk] = useState<any | null>(null);
  const [provider, setProvider] = useState<any | null>(null);
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [subAccountAddress, setSubAccountAddress] = useState<`0x${string}` | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [autoCreateAttempted, setAutoCreateAttempted] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Initialize SDK on mount
  useEffect(() => {
    const config = getBaseAccountConfig();
    
    if (!config.enabled) {
      setIsInitialized(true);
      return;
    }

    // Base Account works with browser-native passkeys (WebAuthn)
    // No Coinbase Wallet extension required!

    try {
      // Configure SDK with Sub Account support
      const sdkConfig: any = {
        appName: config.appName,
        appLogoUrl: config.appLogoUrl,
        appChainIds: config.supportedChainIds,
      };

      // Add Sub Account configuration if enabled
      if (config.subAccounts.enabled) {
        sdkConfig.subAccounts = {
          creation: config.subAccounts.creation,
          defaultAccount: config.subAccounts.defaultAccount,
          funding: config.subAccounts.funding,
          toOwnerAccount: async () => {
            // Get the main Base Account address
            const mainAddress = address;
            if (!mainAddress) {
              return { account: null };
            }

            // Get or create Sub Account owner (private key-based account)
            const ownerAccount = getSubAccountOwner(mainAddress);
            return { account: ownerAccount };
          },
        };
      }

      const baseAccountSDK = createBaseAccountSDK(sdkConfig);
      const baseProvider = baseAccountSDK.getProvider();

      setSdk(baseAccountSDK);
      setProvider(baseProvider);
      setIsInitialized(true);
    } catch (error) {
      console.error('❌ Failed to initialize Base Account SDK:', error);
      setIsInitialized(true); // Mark as initialized even on error
    }
  }, [address]);

  // Connect to Base Account
  const connect = useCallback(async () => {
    if (!provider) {
      const error = 'Base Account provider not initialized';
      setConnectionError(error);
      throw new Error(error);
    }

    // Base Account uses browser-native passkeys (WebAuthn)
    // Works on any modern browser without extensions

    try {
      setConnectionError(null); // Clear previous errors

      // Use wallet_connect with signInWithEthereum capability
      const nonce = crypto.randomUUID().replace(/-/g, '');
      
      // Add timeout to prevent infinite loading (60 seconds for better UX)
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 60000)
      );

      const connectRequest = provider.request({
        method: 'wallet_connect',
        params: [{
          version: '1',
          capabilities: {
            signInWithEthereum: {
              nonce,
              chainId: '0x2105', // Base Mainnet (8453)
            },
          },
        }],
      });

      const response = await Promise.race([connectRequest, timeout]);

      const { accounts } = response;
      const userAddress = accounts[0]?.address as `0x${string}`;

      setAddress(userAddress);
      setIsConnected(true);
      setConnectionError(null);
      setRetryCount(0); // Reset retry count on success


      // If Sub Accounts are enabled, get the sub account address
      const config = getBaseAccountConfig();
      if (config.subAccounts.enabled && sdk) {
        try {
          const subAccount = await sdk.subAccount.get();
          if (subAccount?.address) {
            setSubAccountAddress(subAccount.address);;
          }
        } catch (error) {
          debugLog('⚠️ Sub Account not yet created (will be created on first transaction)');
        }
      }

      // Store connection state
      localStorage.setItem('baseAccountConnected', 'true');
      localStorage.setItem('baseAccountAddress', userAddress);
    } catch (error: any) {
      console.error('❌ Failed to connect to Base Account:', error);
      
      // Set user-friendly error message
      if (error.code === 4001) {
        setConnectionError('User rejected connection');
        throw new Error('User rejected connection');
      } else if (error.message?.includes('timeout')) {
        setConnectionError('Connection timed out. Please try again or install Coinbase Wallet extension.');
        throw error;
      } else {
        setConnectionError(error.message || 'Failed to connect');
        throw error;
      }
    }
  }, [provider, sdk]);

  // Disconnect from Base Account
  const disconnect = useCallback(async () => {
    // Clean up Sub Account keys if they exist
    if (address) {
      deleteSubAccountKey(address);
    }

    setAddress(null);
    setSubAccountAddress(null);
    setIsConnected(false);
    setAutoCreateAttempted(false);
    setConnectionError(null);
    setRetryCount(0);
    
    localStorage.removeItem('baseAccountConnected');
    localStorage.removeItem('baseAccountAddress');
    localStorage.removeItem('baseAccountDeclined');
    
  }, [address]);

  // Switch chain
  const switchChain = useCallback(async (chainId: number) => {
    if (!provider) {
      throw new Error('Base Account provider not initialized');
    }

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });

    } catch (error) {
      console.error(`❌ Failed to switch to chain ${chainId}:`, error);
      throw error;
    }
  }, [provider]);

  // Restore connection on mount
  useEffect(() => {
    const wasConnected = localStorage.getItem('baseAccountConnected') === 'true';
    const savedAddress = localStorage.getItem('baseAccountAddress') as `0x${string}` | null;

    if (wasConnected && savedAddress && provider) {
      setAddress(savedAddress);
      setIsConnected(true);
    }
  }, [provider]);

  // Show persistent prompt for Base Account setup when user is logged in but doesn't have Base Account
  useEffect(() => {
    const config = getBaseAccountConfig();
    
    // Check if Base Account is enabled
    if (!config.enabled) {
      return;
    }

    // Wait for Privy to be ready
    if (!privyReady || !privyAuthenticated) {
      // User not logged in, clear any error
      setConnectionError(null);
      return;
    }

    // User is authenticated, check if they have Base Account
    if (isConnected) {
      // Has Base Account, clear error
      setConnectionError(null);
      return;
    }

    // Check if user has previously declined Base Account creation
    const hasDeclined = localStorage.getItem('baseAccountDeclined') === 'true';
    if (hasDeclined) {
      // User declined, don't show popup
      setConnectionError(null);
      return;
    }

    // User is logged in but doesn't have Base Account - show persistent prompt
    setConnectionError('Set up your Base Account to unlock passkey authentication, gas-free transactions, one-tap USDC payments, and universal identity across Base-enabled apps.');
  }, [privyReady, privyAuthenticated, isConnected]);

  // Auto-create Base Account for authenticated Privy users (only attempts once)
  useEffect(() => {
    const config = getBaseAccountConfig();
    
    // Check if auto-create is enabled
    if (!config.autoCreate || !config.enabled) {
      return;
    }

    // Wait for both Privy and Base Account to be ready
    if (!privyReady || !privyAuthenticated || !isInitialized || !provider) {
      return;
    }

    // Don't create if already connected
    if (isConnected) {
      return;
    }

    // Don't attempt multiple times in the same session
    if (autoCreateAttempted) {
      return;
    }

    // Check if user has previously declined Base Account creation
    const hasDeclined = localStorage.getItem('baseAccountDeclined') === 'true';
    if (hasDeclined) {
      return;
    }

    // Automatically create Base Account with retry logic using passkey
    const createBaseAccount = async () => {
      try {
        setAutoCreateAttempted(true);
        
        await connect();
        
      } catch (error: any) {
        debugLog('⚠️ Base Account auto-creation failed:', error.message);
        
        // If user explicitly rejected, mark it so we don't ask again
        if (error.code === 4001 || error.message?.includes('rejected')) {
          localStorage.setItem('baseAccountDeclined', 'true');
        } else if (error.message?.includes('timeout')) {
          // On timeout, allow retry (don't mark as declined)
          const currentRetry = retryCount + 1;
          setRetryCount(currentRetry);
          
          if (currentRetry < 3) {
            // Retry after a delay
            setAutoCreateAttempted(false); // Allow retry
            setTimeout(() => {
              // Trigger retry by toggling state
            }, 5000); // Wait 5 seconds before retry
          } else {
            // Don't mark as declined - user might want to try manually
          }
        } else {
          debugLog('❌ Unexpected error:', error);
          // Don't mark as declined for unexpected errors
        }
      }
    };

    // Delay slightly to avoid overwhelming the user on login
    const timeout = setTimeout(createBaseAccount, 1000);
    return () => clearTimeout(timeout);
  }, [privyReady, privyAuthenticated, isInitialized, provider, isConnected, autoCreateAttempted, retryCount, connect]);

  const value: BaseAccountContextValue = {
    sdk,
    provider,
    address,
    subAccountAddress,
    isConnected,
    isInitialized,
    connectionError,
    retryCount,
    connect,
    disconnect,
    switchChain,
  };

  return (
    <BaseAccountContext.Provider value={value}>
      {children}
    </BaseAccountContext.Provider>
  );
}

export function useBaseAccount() {
  const context = useContext(BaseAccountContext);
  
  if (!context) {
    throw new Error('useBaseAccount must be used within BaseAccountProvider');
  }
  
  return context;
}
