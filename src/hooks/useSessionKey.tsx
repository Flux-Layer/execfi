"use client";

import { useCallback, useEffect, useState } from "react";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http, type Address } from "viem";
import { base } from "viem/chains";
import { parse as parseSessionData, stringify as stringifySessionData } from "@biconomy/abstractjs";
// import type { GrantPermissionResponse} from '@biconomy/abstractjs';

type GrantPermissionResponse = any

interface SessionKeyConfig {
  validUntil?: bigint;
  validAfter?: bigint;
  sessionValidationModule?: Address;
  sessionKeyData?: string;
}

interface UseSessionKeyReturn {
  sessionKey?: string;
  sessionKeyAddress?: Address;
  createSessionKey: (config?: SessionKeyConfig) => Promise<string>;
  clearSessionKey: () => void;
  isSessionActive: boolean;
  sessionGrant?: GrantPermissionResponse;
  setSessionGrant: (grant?: GrantPermissionResponse) => void;
  sessionEnabled: boolean;
  setSessionEnabled: (enabled: boolean) => void;
}

const SESSION_KEY_STORAGE_KEY = "biconomy_session_key";
const SESSION_CONFIG_STORAGE_KEY = "biconomy_session_config";
const SESSION_GRANT_STORAGE_KEY = "biconomy_session_grant";
const SESSION_ENABLED_STORAGE_KEY = "biconomy_session_enabled";

export function useSessionKey(): UseSessionKeyReturn {
  const [sessionKey, setSessionKey] = useState<string>();
  const [sessionKeyAddress, setSessionKeyAddress] = useState<Address>();
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionGrant, setSessionGrantState] = useState<GrantPermissionResponse>();
  const [sessionEnabled, setSessionEnabledState] = useState(false);


  const clearSessionKey = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(SESSION_KEY_STORAGE_KEY);
      localStorage.removeItem(SESSION_CONFIG_STORAGE_KEY);
      localStorage.removeItem(SESSION_GRANT_STORAGE_KEY);
      localStorage.removeItem(SESSION_ENABLED_STORAGE_KEY);
    }
    setSessionKey(undefined);
    setSessionKeyAddress(undefined);
    setIsSessionActive(false);
    setSessionGrantState(undefined);
    setSessionEnabledState(false);
  }, []);


  // Load existing session key from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedKey = localStorage.getItem(SESSION_KEY_STORAGE_KEY);
      const storedConfig = localStorage.getItem(SESSION_CONFIG_STORAGE_KEY);
      const storedGrant = localStorage.getItem(SESSION_GRANT_STORAGE_KEY);
      const storedEnabled = localStorage.getItem(SESSION_ENABLED_STORAGE_KEY);

      if (storedKey && storedConfig) {
        const config = JSON.parse(storedConfig);
        const now = BigInt(Math.floor(Date.now() / 1000));

        // Check if session is still valid
        if (config.validUntil && now < BigInt(config.validUntil)) {
          setSessionKey(storedKey);
          const account = privateKeyToAccount(storedKey as `0x${string}`);
          setSessionKeyAddress(account.address);
          setIsSessionActive(true);
          if (storedGrant) {
            try {
              const parsed = parseSessionData(storedGrant) as GrantPermissionResponse;
              setSessionGrantState(parsed);
            } catch (error) {
              console.warn("Failed to parse stored session grant", error);
            }
          }
          if (storedEnabled) {
            setSessionEnabledState(storedEnabled === "true");
          }
        } else {
          // Clear expired session
          clearSessionKey();
        }
      }
    }
  }, [clearSessionKey]);

  const createSessionKey = useCallback(async (config: SessionKeyConfig = {}) => {
    try {
      // Generate a new private key for the session
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);

      // Default session configuration (24 hours)
      const defaultConfig: SessionKeyConfig = {
        validUntil: BigInt(Math.floor(Date.now() / 1000) + 24 * 60 * 60), // 24 hours from now
        validAfter: BigInt(Math.floor(Date.now() / 1000)), // Valid from now
        ...config
      };

      // Store session key and config in localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem(SESSION_KEY_STORAGE_KEY, privateKey);
        localStorage.setItem(SESSION_CONFIG_STORAGE_KEY, JSON.stringify({
          validUntil: defaultConfig.validUntil?.toString(),
          validAfter: defaultConfig.validAfter?.toString(),
          sessionValidationModule: defaultConfig.sessionValidationModule,
          sessionKeyData: defaultConfig.sessionKeyData,
        }));
      }

      setSessionKey(privateKey);
      setSessionKeyAddress(account.address);
      setIsSessionActive(true);
      setSessionEnabledState(false);

      console.log("✅ Session key created:", {
        address: account.address,
        validUntil: new Date(Number(defaultConfig.validUntil) * 1000),
      });

      return privateKey;
    } catch (error) {
      console.error("Failed to create session key:", error);
      throw error;
    }
  }, []);

  
  const setSessionGrant = useCallback((grant?: GrantPermissionResponse) => {
    if (typeof window !== "undefined") {
      if (grant) {
        localStorage.setItem(SESSION_GRANT_STORAGE_KEY, stringifySessionData(grant));
      } else {
        localStorage.removeItem(SESSION_GRANT_STORAGE_KEY);
      }
    }
    setSessionGrantState(grant);
  }, []);

  const setSessionEnabled = useCallback((enabled: boolean) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(SESSION_ENABLED_STORAGE_KEY, String(enabled));
    }
    setSessionEnabledState(enabled);
  }, []);

  return {
    sessionKey,
    sessionKeyAddress,
    createSessionKey,
    clearSessionKey,
    isSessionActive,
    sessionGrant,
    setSessionGrant,
    sessionEnabled,
    setSessionEnabled,
  };
}

// Helper function to create a session key wallet client
export function createSessionKeyWalletClient(sessionKey: string, chainId: number = 8453) {
  console.log("🔧 Creating session key wallet client for chainId:", chainId);

  if (!sessionKey) {
    throw new Error("Session key is required");
  }

  const account = privateKeyToAccount(sessionKey as `0x${string}`);
  console.log("🔧 Session key account created:", account.address);

  const chainMap: Record<number, any> = {
    8453: base,
    // Add other chains as needed
  };

  const chain = chainMap[chainId] || base;
  console.log("🔧 Using chain:", chain.name, "chainId:", chain.id);

  // Use the same RPC URL mapping as the main hook
  const RPC_URLS: Record<number, string> = {
    8453: `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
    1: `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
    42161: `https://arb-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
    137: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
  };

  const rpcUrl = RPC_URLS[chainId];
  if (!rpcUrl) {
    throw new Error(`No RPC URL configured for chainId ${chainId}`);
  }

  console.log("🔧 Using RPC URL:", rpcUrl.substring(0, 50) + "...");

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  console.log("🔧 Session key wallet client created successfully");
  return walletClient;
}
