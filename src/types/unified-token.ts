// types/unified-token.ts - Unified token schema for multi-provider system

import type { ProviderName, LifiTokenMetadata, RelayTokenMetadata, LocalTokenMetadata, CoinGeckoTokenMetadata } from './provider-types';

/**
 * Unified token interface that standardizes token data across all providers
 */
export interface UnifiedToken {
  // Core token data
  address: string;
  symbol: string;
  name: string;
  chainId: number;
  chainName?: string;
  decimals: number;

  // Enhanced metadata
  logoURI?: string;
  verified: boolean;
  priceUSD?: string;
  lastUpdated?: string;

  // Provider context
  sources: ProviderName[];
  confidence: number; // 0-100 based on source reliability

  // Provider-specific metadata
  metadata: {
    lifi?: LifiTokenMetadata;
    relay?: RelayTokenMetadata;
    local?: LocalTokenMetadata;
    coingecko?: CoinGeckoTokenMetadata;
  };
}

/**
 * Provider-specific result structure
 */
export interface ProviderTokenResult {
  provider: ProviderName;
  success: boolean;
  tokens: UnifiedToken[];
  error?: string;
  responseTime?: number;
}

/**
 * Multi-provider search result
 */
export interface MultiProviderResult {
  success: boolean;
  tokens: UnifiedToken[];
  metadata: {
    totalResults: number;
    providersQueried: ProviderName[];
    providersSuccessful: ProviderName[];
    providersFailed: ProviderName[];
    averageConfidence: number;
    queryTime: number;
    cacheHit: boolean;
  };
  providerSummary: {
    [key in ProviderName]?: {
      results: number;
      responseTime: number;
      status: 'success' | 'failed' | 'timeout';
      error?: string;
    };
  };
}

/**
 * Token search response for API endpoints
 */
export interface MultiProviderTokenResponse {
  success: boolean;
  tokens: UnifiedToken[];
  metadata: {
    totalResults: number;
    providersQueried: string[];
    providersSuccessful: string[];
    providersFailed: string[];
    averageConfidence: number;
    queryTime: number;
    cacheHit: boolean;
  };
  providerSummary: {
    [providerName: string]: {
      results: number;
      responseTime: number;
      status: 'success' | 'failed' | 'timeout';
      error?: string;
    };
  };
}

/**
 * Token group for deduplication and merging
 */
export interface TokenGroup {
  identifier: string; // address_chainId
  tokens: UnifiedToken[];
  merged?: UnifiedToken;
}

/**
 * Similar token group for fuzzy matching
 */
export interface SimilarTokenGroup {
  symbol: string;
  tokens: UnifiedToken[];
  confidence: number;
}