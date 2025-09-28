// lib/token-providers/index.ts - Export all provider-related functionality

export { BaseTokenProvider } from './base-provider';
export { TokenProviderRegistry, tokenProviderRegistry } from './registry';

// Provider implementations
export { LifiTokenProvider, lifiTokenProvider } from './lifi-provider';
export { RelayTokenProvider, relayTokenProvider } from './relay-provider';
export { LocalTokenProvider, localTokenProvider } from './local-provider';

// Re-export types for convenience
export type {
  TokenProvider,
  ProviderName,
  TokenSearchParams,
  HealthStatus,
  ProviderResult,
  LifiTokenMetadata,
  RelayTokenMetadata,
  LocalTokenMetadata,
  CoinGeckoTokenMetadata,
} from '@/types/provider-types';

export type {
  UnifiedToken,
  ProviderTokenResult,
  MultiProviderResult,
  MultiProviderTokenResponse,
  TokenGroup,
  SimilarTokenGroup,
} from '@/types/unified-token';