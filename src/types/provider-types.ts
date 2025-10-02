// types/provider-types.ts - Provider interface definitions

export type ProviderName = 'lifi' | 'relay' | 'local' | 'coingecko';

/**
 * Standard search parameters for token providers
 */
export interface TokenSearchParams {
  symbol?: string;
  chainIds?: number[];
  limit?: number;
  address?: string;
}

/**
 * Health check status for providers
 */
export interface HealthStatus {
  healthy: boolean;
  lastCheck: Date;
  responseTime?: number;
  error?: string;
}

/**
 * Result from a single provider query
 */
export interface ProviderResult<T = any> {
  provider: ProviderName;
  success: boolean;
  data?: T;
  error?: string;
  responseTime?: number;
}

/**
 * Provider-specific metadata structures
 */
export interface LifiTokenMetadata {
  coinKey?: string;
  priceUSD?: string;
  verified: boolean;
}

export interface RelayTokenMetadata {
  vmType?: string;
  depositAddressOnly: boolean;
}

export interface LocalTokenMetadata {
  registrySource: string;
}

export interface CoinGeckoTokenMetadata {
  marketCap?: number;
  rank?: number;
}

/**
 * Base token provider interface
 */
export interface TokenProvider {
  name: ProviderName;
  priority: number;
  enabled: boolean;

  /**
   * Search for tokens matching the given parameters
   */
  searchTokens(params: TokenSearchParams): Promise<any[]>;

  /**
   * Get detailed information about a specific token (optional)
   */
  getTokenDetails?(address: string, chainId: number): Promise<any | null>;

  /**
   * Health check for the provider (optional)
   */
  healthCheck?(): Promise<boolean>;
}