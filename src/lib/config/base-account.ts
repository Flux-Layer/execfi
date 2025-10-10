/**
 * Base Account SDK Configuration
 * 
 * This module provides configuration for Base Account integration,
 * including SDK setup and optional Paymaster (gas sponsorship) settings.
 */

export interface SubAccountConfig {
  enabled: boolean;
  creation: 'on-connect' | 'manual';
  defaultAccount: 'sub' | 'universal';
  funding: 'spend-permissions' | 'manual';
}

export interface BaseAccountConfig {
  appName: string;
  appLogoUrl: string;
  supportedChainIds: number[];
  enabled: boolean;
  autoCreate: boolean;
  subAccounts: SubAccountConfig;
}

export interface PaymasterConfig {
  enabled: boolean;
  proxyUrl?: string;
  sponsoredChains?: number[];
  sponsoredOperations?: ('transfer' | 'swap' | 'bridge')[];
  maxGasPerTx?: bigint;
}

/**
 * Get Base Account SDK configuration from environment variables
 */
export function getBaseAccountConfig(): BaseAccountConfig {
  return {
    appName: process.env.NEXT_PUBLIC_BASE_ACCOUNT_APP_NAME || 'ExecFi',
    appLogoUrl: process.env.NEXT_PUBLIC_BASE_ACCOUNT_LOGO_URL || '',
    supportedChainIds: process.env.NEXT_PUBLIC_BASE_ACCOUNT_SUPPORTED_CHAINS
      ?.split(',')
      .map(Number) || [8453, 84532], // Base Mainnet, Base Sepolia
    enabled: process.env.NEXT_PUBLIC_ENABLE_BASE_ACCOUNT === 'true',
    autoCreate: process.env.NEXT_PUBLIC_BASE_ACCOUNT_AUTO_CREATE === 'true',
    subAccounts: {
      enabled: process.env.NEXT_PUBLIC_BASE_SUB_ACCOUNTS_ENABLED === 'true',
      creation: (process.env.NEXT_PUBLIC_BASE_SUB_ACCOUNTS_CREATION as 'on-connect' | 'manual') || 'on-connect',
      defaultAccount: (process.env.NEXT_PUBLIC_BASE_SUB_ACCOUNTS_DEFAULT as 'sub' | 'universal') || 'sub',
      funding: (process.env.NEXT_PUBLIC_BASE_SUB_ACCOUNTS_FUNDING as 'spend-permissions' | 'manual') || 'spend-permissions',
    },
  };
}

/**
 * Get Paymaster (gas sponsorship) configuration
 * 
 * Note: Paymaster is disabled by default. To enable:
 * 1. Set NEXT_PUBLIC_ENABLE_PAYMASTER=true
 * 2. Provide NEXT_PUBLIC_PAYMASTER_PROXY_URL
 * 3. Configure allowlist on Coinbase Developer Platform
 */
export function getPaymasterConfig(): PaymasterConfig {
  return {
    enabled: process.env.NEXT_PUBLIC_ENABLE_PAYMASTER === 'true',
    proxyUrl: process.env.NEXT_PUBLIC_PAYMASTER_PROXY_URL,
    sponsoredChains: [8453], // Only Base Mainnet initially
    sponsoredOperations: [], // Empty = don't sponsor anything yet
    maxGasPerTx: undefined, // No limit initially
  };
}
