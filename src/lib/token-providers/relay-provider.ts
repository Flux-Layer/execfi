// lib/token-providers/relay-provider.ts - Relay provider implementation

import { BaseTokenProvider } from './base-provider';
import { fetcher } from '@/lib/utils/fetcher';
import type { TokenSearchParams, ProviderName, RelayTokenMetadata } from '@/types/provider-types';
import type { UnifiedToken } from '@/types/unified-token';

/**
 * Relay API response types
 */
interface RelayToken {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  metadata?: {
    vmType?: string;
    depositAddressOnly?: boolean;
  };
}

interface RelayResponse {
  tokens?: RelayToken[];
  currencies?: RelayToken[]; // Alternative field name
}

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
 * Relay Token Provider Implementation
 * Integrates with the existing Relay API endpoint
 */
export class RelayTokenProvider extends BaseTokenProvider {
  public readonly name: ProviderName = 'relay';
  public readonly priority: number = 80; // Lower priority than LI.FI

  private readonly baseUrl = "https://api.relay.link";
  private readonly apiPath = "/currencies/v2";

  constructor() {
    super(process.env.ENABLE_RELAY_PROVIDER !== 'false');
  }

  /**
   * Search for tokens using Relay API
   */
  public async searchTokens(params: TokenSearchParams): Promise<UnifiedToken[]> {
    this.validateSearchParams(params);

    try {
      console.log(`🔍 Relay Provider searching tokens:`, params);

      // Convert multi-provider params to Relay format
      const relayPayload = {
        chainIds: params.chainIds || [8453], // Default to Base
        term: params.symbol || "",
        defaultList: false,
        limit: params.limit || 20,
        depositAddressOnly: false,
        referrer: "execfi.com",
      };

      const options = {
        method: "POST" as const,
        headers: {
          "Content-Type": "application/json",
        },
        body: relayPayload,
      };

      console.log(`📡 Making Relay API request:`, relayPayload);

      // Use the existing fetcher utility
      const { data, error } = await fetcher(this.baseUrl, this.apiPath, options);

      if (error) {
        throw new Error(`Relay API error: ${error}`);
      }

      if (!data) {
        console.warn(`⚠️ Relay API returned no data`);
        return [];
      }

      // Handle different response formats
      const tokens: RelayToken[] = (data as any)?.tokens || (data as any)?.currencies || (Array.isArray(data) ? data : []);

      if (!Array.isArray(tokens)) {
        console.warn(`⚠️ Relay API returned non-array response:`, typeof tokens);
        return [];
      }

      console.log(`✅ Relay Provider found ${tokens.length} tokens`);

      return this.convertToUnified(tokens);

    } catch (error) {
      console.error(`❌ Relay Provider search failed:`, error);
      throw new Error(`Relay search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get detailed token information by address
   */
  public async getTokenDetails(address: string, chainId: number): Promise<UnifiedToken | null> {
    try {
      // Search for tokens on the specific chain and filter by address
      const result = await this.searchTokens({ chainIds: [chainId], limit: 100 });

      // Find the token with matching address
      const matchingToken = result.find(
        token => token.address.toLowerCase() === address.toLowerCase()
      );

      return matchingToken || null;

    } catch (error) {
      console.error(`❌ Relay Provider getTokenDetails failed:`, error);
      return null;
    }
  }

  /**
   * Health check using Relay API
   */
  protected async performHealthCheck(): Promise<boolean> {
    try {
      // Perform a lightweight test search
      const result = await this.searchTokens({ chainIds: [8453], limit: 1 });
      return Array.isArray(result);
    } catch {
      return false;
    }
  }

  /**
   * Convert Relay tokens to unified format
   */
  private convertToUnified(relayTokens: RelayToken[]): UnifiedToken[] {
    return relayTokens.map((token): UnifiedToken => {
      // Calculate confidence based on data availability
      const hasPrice = false; // Relay doesn't provide price data
      const hasLogo = !!token.logoURI;
      const verified = false; // Relay tokens are not automatically verified

      const confidence = this.calculateConfidence(hasPrice, hasLogo, verified);

      // Create Relay specific metadata
      const relayMetadata: RelayTokenMetadata = {
        vmType: token.metadata?.vmType,
        depositAddressOnly: token.metadata?.depositAddressOnly || false,
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
        priceUSD: undefined, // Relay doesn't provide price data
        lastUpdated: new Date().toISOString(),

        // Provider context
        sources: ['relay'],
        confidence,

        // Provider-specific metadata
        metadata: {
          relay: relayMetadata,
        },
      };

      return unifiedToken;
    });
  }
}

// Export singleton instance with environment-based enablement
export const relayTokenProvider = new RelayTokenProvider();