// lib/token-providers/local-provider.ts - Local registry provider implementation

import { BaseTokenProvider } from './base-provider';
import { searchTokensBySymbol, getTokensForChain, getTokenByAddress, type Token } from '@/lib/tokens';
import { getChainConfig } from '@/lib/chains/registry';
import type { TokenSearchParams, ProviderName, LocalTokenMetadata } from '@/types/provider-types';
import type { UnifiedToken } from '@/types/unified-token';

/**
 * Chain ID to name mapping
 */
const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  137: "Polygon",
  42161: "Arbitrum",
  10: "Optimism",
  43114: "Avalanche",
  56: "BNB Chain",
  250: "Fantom",
  100: "Gnosis",
  1284: "Moonbeam",
  1285: "Moonriver",
  25: "Cronos",
  1101: "Polygon zkEVM",
  324: "zkSync Era",
  59144: "Linea",
  5000: "Mantle",
  534352: "Scroll",
};

/**
 * Local Token Provider Implementation
 * Wraps the existing local token registry with the multi-provider interface
 */
export class LocalTokenProvider extends BaseTokenProvider {
  public readonly name: ProviderName = 'local';
  public readonly priority: number = 60; // Fallback provider priority

  constructor() {
    super(true); // Always enabled as fallback
  }

  /**
   * Search for tokens using local registry
   */
  public async searchTokens(params: TokenSearchParams): Promise<UnifiedToken[]> {
    this.validateSearchParams(params);

    try {
      console.log(`🔍 Local Provider searching tokens:`, params);

      let allTokens: Token[] = [];

      if (params.symbol) {
        // Search by symbol across specified chains
        if (params.chainIds && params.chainIds.length > 0) {
          // Search across multiple chains
          const chainPromises = params.chainIds.map(chainId => {
            try {
              return searchTokensBySymbol(params.symbol!, chainId);
            } catch {
              return []; // Ignore chains that don't have tokens
            }
          });

          const chainResults = await Promise.all(chainPromises);
          allTokens = chainResults.flat();
        } else {
          // Search across all supported chains
          const supportedChains = [1, 8453, 137, 42161, 10, 43114]; // Main chains
          const chainPromises = supportedChains.map(chainId => {
            try {
              return searchTokensBySymbol(params.symbol!, chainId);
            } catch {
              return [];
            }
          });

          const chainResults = await Promise.all(chainPromises);
          allTokens = chainResults.flat();
        }
      } else if (params.chainIds && params.chainIds.length > 0) {
        // Get all tokens for specified chains
        const chainPromises = params.chainIds.map(chainId => {
          try {
            return getTokensForChain(chainId);
          } catch {
            return [];
          }
        });

        const chainResults = await Promise.all(chainPromises);
        allTokens = chainResults.flat();
      } else {
        // Get tokens from all supported chains
        const supportedChains = [1, 8453, 137, 42161, 10, 43114];
        const chainPromises = supportedChains.map(chainId => {
          try {
            return getTokensForChain(chainId);
          } catch {
            return [];
          }
        });

        const chainResults = await Promise.all(chainPromises);
        allTokens = chainResults.flat();
      }

      // Apply limit if specified
      if (params.limit) {
        allTokens = allTokens.slice(0, params.limit);
      }

      console.log(`✅ Local Provider found ${allTokens.length} tokens`);

      return this.convertToUnified(allTokens);

    } catch (error) {
      console.error(`❌ Local Provider search failed:`, error);
      throw new Error(`Local search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get detailed token information by address
   */
  public async getTokenDetails(address: string, chainId: number): Promise<UnifiedToken | null> {
    try {
      const token = getTokenByAddress(address, chainId);

      if (!token) {
        return null;
      }

      return this.convertToUnified([token])[0];

    } catch (error) {
      console.error(`❌ Local Provider getTokenDetails failed:`, error);
      return null;
    }
  }

  /**
   * Health check for local registry (always healthy)
   */
  protected async performHealthCheck(): Promise<boolean> {
    try {
      // Test basic functionality by getting tokens for Base chain
      const tokens = getTokensForChain(8453);
      return Array.isArray(tokens);
    } catch {
      return false;
    }
  }

  /**
   * Convert local tokens to unified format
   */
  private convertToUnified(localTokens: Token[]): UnifiedToken[] {
    return localTokens.map((token): UnifiedToken => {
      // Calculate confidence based on data availability
      const hasPrice = false; // Local registry doesn't have price data
      const hasLogo = !!token.logoURI;
      const verified = token.verified || false;

      const confidence = this.calculateConfidence(hasPrice, hasLogo, verified);

      // Determine registry source
      const chainConfig = getChainConfig(token.chainId);
      const registrySource = chainConfig?.name || 'local-registry';

      // Create Local specific metadata
      const localMetadata: LocalTokenMetadata = {
        registrySource,
      };

      const unifiedToken: UnifiedToken = {
        // Core token data
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        chainId: token.chainId,
        chainName: CHAIN_NAMES[token.chainId] || `Chain ${token.chainId}`,
        decimals: token.decimals,

        // Enhanced metadata
        logoURI: token.logoURI,
        verified: verified,
        priceUSD: undefined, // Local registry doesn't provide price data
        lastUpdated: new Date().toISOString(),

        // Provider context
        sources: ['local'],
        confidence,

        // Provider-specific metadata
        metadata: {
          local: localMetadata,
        },
      };

      return unifiedToken;
    });
  }
}

// Export singleton instance (always enabled)
export const localTokenProvider = new LocalTokenProvider();