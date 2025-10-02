// lib/token-providers/lifi-provider.ts - LI.FI provider implementation

import { BaseTokenProvider } from './base-provider';
import { searchTokens, healthCheck, type LifiToken } from '@/lib/lifi-client';
import type { TokenSearchParams, ProviderName, LifiTokenMetadata } from '@/types/provider-types';
import type { UnifiedToken } from '@/types/unified-token';

/**
 * Chain ID to name mapping for enhanced responses
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
 * LI.FI Token Provider Implementation
 * Wraps the existing LI.FI client with the multi-provider interface
 */
export class LifiTokenProvider extends BaseTokenProvider {
  public readonly name: ProviderName = 'lifi';
  public readonly priority: number = 100; // Highest priority for pricing data and verification

  constructor() {
    super(process.env.ENABLE_LIFI_PROVIDER !== 'false');
  }

  /**
   * Search for tokens using LI.FI API
   */
  public async searchTokens(params: TokenSearchParams): Promise<UnifiedToken[]> {
    this.validateSearchParams(params);

    try {
      console.log(`🔍 LI.FI Provider searching tokens:`, params);

      // Convert multi-provider params to LI.FI format
      const lifiParams = {
        symbol: params.symbol,
        chain: params.chainIds?.[0], // LI.FI client expects single chain ID
        limit: params.limit || 50,
      };

      // If multiple chains specified, we need to make multiple requests
      if (params.chainIds && params.chainIds.length > 1) {
        const chainPromises = params.chainIds.map(async (chainId) => {
          const result = await searchTokens({ ...lifiParams, chain: chainId });
          return result.tokens;
        });

        const chainResults = await Promise.allSettled(chainPromises);
        const allTokens: LifiToken[] = [];

        chainResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            allTokens.push(...result.value);
          }
        });

        return this.convertToUnified(allTokens);
      } else {
        // Single chain or no chain specified
        const result = await searchTokens(lifiParams);
        return this.convertToUnified(result.tokens);
      }

    } catch (error) {
      console.error(`❌ LI.FI Provider search failed:`, error);
      throw new Error(`LI.FI search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get detailed token information by address
   */
  public async getTokenDetails(address: string, chainId: number): Promise<UnifiedToken | null> {
    try {
      // Search for the specific token by making a targeted search
      const result = await searchTokens({ limit: 100 });

      // Find the token with matching address and chainId
      const matchingToken = result.tokens.find(
        token => token.address.toLowerCase() === address.toLowerCase() && token.chainId === chainId
      );

      if (!matchingToken) {
        return null;
      }

      return this.convertToUnified([matchingToken])[0];

    } catch (error) {
      console.error(`❌ LI.FI Provider getTokenDetails failed:`, error);
      return null;
    }
  }

  /**
   * Health check using LI.FI client
   */
  protected async performHealthCheck(): Promise<boolean> {
    try {
      return await healthCheck();
    } catch {
      return false;
    }
  }

  /**
   * Convert LI.FI tokens to unified format
   */
  private convertToUnified(lifiTokens: LifiToken[]): UnifiedToken[] {
    return lifiTokens.map((token): UnifiedToken => {
      // Calculate confidence based on data availability
      const hasPrice = !!token.priceUSD;
      const hasLogo = !!token.logoURI;
      const verified = true; // LI.FI tokens are generally verified

      const confidence = this.calculateConfidence(hasPrice, hasLogo, verified);

      // Create LI.FI specific metadata
      const lifiMetadata: LifiTokenMetadata = {
        priceUSD: token.priceUSD,
        verified: verified,
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
        priceUSD: token.priceUSD,
        lastUpdated: new Date().toISOString(),

        // Provider context
        sources: ['lifi'],
        confidence,

        // Provider-specific metadata
        metadata: {
          lifi: lifiMetadata,
        },
      };

      return unifiedToken;
    });
  }
}

// Export singleton instance with environment-based enablement
export const lifiTokenProvider = new LifiTokenProvider();