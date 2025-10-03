// lib/normalize.ts - Intent normalization router layer
// Routes intents to isolated domain modules (Transfer or DeFi)

import type { IntentSuccess, TransferIntent } from "./ai";
import { resolveTokenSymbol, type Token } from "./tokens";
import { resolveChain } from "./chains/registry";
import { LifiApiClient, TokenApiClient, type TokenSearchResponse, type MultiProviderSearchRequest } from "./api-client";
import type { MultiProviderTokenResponse } from "@/types/unified-token";

export type NormalizedNativeTransfer = {
  kind: "native-transfer";
  chainId: number;
  to: `0x${string}`;
  amountWei: bigint;
};

export type NormalizedERC20Transfer = {
  kind: "erc20-transfer";
  chainId: number;
  to: `0x${string}`;
  token: {
    address: `0x${string}`;
    symbol: string;
    decimals: number;
  };
  amountWei: bigint;
};

export type NormalizedSwap = {
  kind: "swap";
  fromChainId: number;
  toChainId: number; // Same as fromChainId for swaps
  fromToken: {
    address: `0x${string}`;
    symbol: string;
    decimals: number;
  };
  toToken: {
    address: `0x${string}`;
    symbol: string;
    decimals: number;
  };
  fromAmount: bigint;
  recipient: `0x${string}`; // Defaults to sender
  toAmountMin?: bigint; // Will be set during planning
  route?: any; // LI.FI route cache
};

export type NormalizedBridge = {
  kind: "bridge";
  fromChainId: number;
  toChainId: number;
  token: {
    address: `0x${string}`;
    symbol: string;
    decimals: number;
  };
  amount: bigint;
  recipient: `0x${string}`; // Defaults to sender's address on destination chain
  toAmountMin?: bigint; // Will be set during planning
  route?: any; // LI.FI route cache
};

export type NormalizedBridgeSwap = {
  kind: "bridge-swap";
  fromChainId: number;
  toChainId: number;
  fromToken: {
    address: `0x${string}`;
    symbol: string;
    decimals: number;
  };
  toToken: {
    address: `0x${string}`;
    symbol: string;
    decimals: number;
  };
  fromAmount: bigint;
  recipient: `0x${string}`; // Defaults to sender's address on destination chain
  toAmountMin?: bigint; // Will be set during planning
  route?: any; // LI.FI route cache
};

export type NormalizedIntent =
  | NormalizedNativeTransfer
  | NormalizedERC20Transfer
  | NormalizedSwap
  | NormalizedBridge
  | NormalizedBridgeSwap;

export class NormalizationError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "NormalizationError";
  }
}

export class TokenSelectionError extends Error {
  constructor(
    message: string,
    public code: string,
    public tokens: Token[],
  ) {
    super(message);
    this.name = "TokenSelectionError";
  }
}

/**
 * Resolve chain name to chainId using centralized registry
 * @deprecated - Use isolated modules (lib/transfer or lib/defi) for chain resolution
 */
function resolveChainForNormalization(chain: string | number): number {
  try {
    const chainConfig = resolveChain(chain);
    return chainConfig.id;
  } catch (error) {
    throw new NormalizationError(
      error instanceof Error ? error.message : `Unsupported chain: ${chain}`,
      "CHAIN_UNSUPPORTED"
    );
  }
}

/**
 * Enhanced token resolution using LI.FI API
 * Step 1.4: Token Disambiguation Flow
 */
async function resolveLifiToken(
  symbol: string,
  chainId?: number
): Promise<{ needsSelection: boolean; tokens: TokenSearchResponse['tokens']; message?: string }> {
  try {
    // Use LI.FI API for comprehensive token search
    const searchResult = await LifiApiClient.searchTokens({
      symbol: symbol.toUpperCase(),
      chains: chainId ? [chainId] : undefined,
      limit: 50,
    });

    if (!searchResult.success || searchResult.tokens.length === 0) {
      return {
        needsSelection: false,
        tokens: [],
        message: `Token '${symbol}' not found on ${chainId ? `chain ${chainId}` : 'any supported chain'}`
      };
    }

    // Filter for exact symbol matches (case-insensitive)
    const exactMatches = searchResult.tokens.filter(
      token => token.symbol.toLowerCase() === symbol.toLowerCase()
    );

    if (exactMatches.length === 0) {
      return {
        needsSelection: false,
        tokens: [],
        message: `No exact matches found for token '${symbol}'`
      };
    }

    // If only one match, return it directly
    if (exactMatches.length === 1) {
      return {
        needsSelection: false,
        tokens: exactMatches,
      };
    }

    // Multiple matches found - needs user selection
    return {
      needsSelection: true,
      tokens: exactMatches,
      message: `Multiple '${symbol}' tokens found across different chains. Please select one:`
    };

  } catch (error) {
    console.warn("LI.FI token resolution failed, falling back to local resolution:", error);

    // Fallback to existing token resolution
    const fallbackResult = resolveTokenSymbol(symbol, chainId || 0);
    if (fallbackResult.needsSelection) {
      return {
        needsSelection: true,
        tokens: fallbackResult.tokens.map(token => ({
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          chainId: token.chainId,
          chainName: `Chain ${token.chainId}`,
          decimals: token.decimals,
          logoURI: token.logoURI,
          verified: token.verified || false,
          priceUSD: undefined,
        })),
        message: fallbackResult.message
      };
    } else {
      return {
        needsSelection: false,
        tokens: [{
          address: fallbackResult.token.address,
          symbol: fallbackResult.token.symbol,
          name: fallbackResult.token.name,
          chainId: fallbackResult.token.chainId,
          chainName: `Chain ${fallbackResult.token.chainId}`,
          decimals: fallbackResult.token.decimals,
          logoURI: fallbackResult.token.logoURI,
          verified: fallbackResult.token.verified || false,
          priceUSD: undefined,
        }],
      };
    }
  }
}

/**
 * Enhanced multi-provider token resolution using the new unified system
 * Queries multiple providers simultaneously for better coverage and reliability
 */
export async function resolveTokensMultiProvider(
  symbol: string,
  chainId?: number
): Promise<{
  needsSelection: boolean;
  tokens: TokenSearchResponse['tokens'];
  message?: string;
  providerSummary?: MultiProviderTokenResponse['providerSummary'];
}> {
  try {
    console.log(`🔍 Multi-provider token resolution for '${symbol}' on chain ${chainId || 'any'}`);

    // Build multi-provider search request
    const searchRequest: MultiProviderSearchRequest = {
      symbol: symbol.toUpperCase(),
      chainIds: chainId ? [chainId] : undefined,
      limit: 50,
      deduplicate: true,
      sortBy: 'confidence',
      sortOrder: 'desc',
      includeMetadata: true,
      includeHealth: false, // Don't include health for faster response
    };

    // Use the new multi-provider API
    const searchResult = await TokenApiClient.searchTokensMultiProvider(searchRequest);

    if (!searchResult.success || searchResult.tokens.length === 0) {
      console.log(`⚠️ No tokens found via multi-provider search, falling back to single-provider`);

      // Fallback to existing LI.FI resolution
      return await resolveLifiToken(symbol, chainId);
    }

    // Convert UnifiedToken[] to TokenSearchResponse format for compatibility
    const compatibleTokens: TokenSearchResponse['tokens'] = searchResult.tokens.map(token => ({
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      chainId: token.chainId,
      chainName: token.chainName || `Chain ${token.chainId}`,
      decimals: token.decimals,
      logoURI: token.logoURI,
      verified: token.verified,
      priceUSD: token.priceUSD,
    }));

    // Enhanced filtering: exact matches + relevant partial matches
    const searchSymbol = symbol.toLowerCase();

    // First priority: exact matches
    const exactMatches = compatibleTokens.filter(
      token => token.symbol.toLowerCase() === searchSymbol
    );

    // Second priority: partial matches (contains the symbol)
    const partialMatches = compatibleTokens.filter(
      token => {
        const tokenSymbol = token.symbol.toLowerCase();
        return tokenSymbol !== searchSymbol && tokenSymbol.includes(searchSymbol);
      }
    );

    // Combine with exact matches first, then partial matches (limited to prevent overwhelming)
    const relevantMatches = [
      ...exactMatches,
      ...partialMatches.slice(0, Math.max(0, 20 - exactMatches.length)) // Limit total to ~20
    ];

    if (relevantMatches.length === 0) {
      return {
        needsSelection: false,
        tokens: [],
        message: `No matches found for token '${symbol}'`,
        providerSummary: searchResult.providerSummary,
      };
    }

    // Log provider summary for debugging
    const providersUsed = searchResult.metadata.providersSuccessful;
    const providerCount = providersUsed.length;
    const totalMatches = relevantMatches.length;
    const exactCount = exactMatches.length;
    const partialCount = partialMatches.length;

    console.log(`✅ Multi-provider search found ${totalMatches} matches (${exactCount} exact, ${partialCount} partial) from ${providerCount} providers:`, providersUsed);

    // If only one match, return it directly
    if (relevantMatches.length === 1) {
      const matchType = exactMatches.length === 1 ? 'exact match' : 'related token';
      const enhancedMessage = `Found ${matchType} via ${providerCount} provider${providerCount > 1 ? 's' : ''}: ${providersUsed.join(', ')}`;

      return {
        needsSelection: false,
        tokens: relevantMatches,
        message: enhancedMessage,
        providerSummary: searchResult.providerSummary,
      };
    }

    // Multiple matches found - needs user selection
    const matchDescription = exactCount > 0 && partialCount > 0
      ? `${exactCount} exact and ${partialCount} related '${symbol}' tokens`
      : exactCount > 0
        ? `Multiple '${symbol}' tokens`
        : `${partialCount} '${symbol}'-related tokens`;

    const enhancedMessage = `${matchDescription} found across ${providerCount} provider${providerCount > 1 ? 's' : ''} (${providersUsed.join(', ')}). Please select one:`;

    return {
      needsSelection: true,
      tokens: relevantMatches,
      message: enhancedMessage,
      providerSummary: searchResult.providerSummary,
    };

  } catch (error) {
    console.warn("Multi-provider token resolution failed, falling back to single-provider:", error);

    // Fallback to existing LI.FI resolution
    return await resolveLifiToken(symbol, chainId);
  }
}

/**
 * Enhanced TokenSelectionError with LI.FI token data
 */
export class EnhancedTokenSelectionError extends Error {
  constructor(
    message: string,
    public code: string,
    public lifiTokens: TokenSearchResponse['tokens'],
  ) {
    super(message);
    this.name = "EnhancedTokenSelectionError";
  }
}

/**
 * Normalize transfer intent (ISOLATED SYSTEM)
 * Routes to isolated transfer module for complete separation from DeFi flows
 *
 * @param intent - Transfer intent from AI parser
 * @param _opts - Options (unused in isolated system, kept for API compatibility)
 * @returns Normalized transfer intent
 * @see lib/transfer/normalize.ts for implementation
 */
export async function normalizeTransferIntent(
  intent: TransferIntent,
  _opts?: { preferredChainId?: number }
): Promise<NormalizedIntent> {
  const { normalizeTransferIntent: isolatedNormalize } = await import("./transfer/normalize");
  return await isolatedNormalize(intent);
}

// ⚠️ DEPRECATED FUNCTIONS REMOVED (Phase 5 Cleanup)
// The following functions have been moved to isolated modules:
// - normalizeSwapIntent → lib/defi/normalize.ts
// - normalizeBridgeIntent → lib/defi/normalize.ts
// - normalizeBridgeSwapIntent → lib/defi/normalize.ts
//
// All DeFi operations now route through the isolated DeFi module via normalizeIntent()

/**
 * Main normalization router - delegates to isolated domain modules
 *
 * Architecture:
 * - Transfer operations → lib/transfer/normalize.ts (isolated)
 * - DeFi operations (swap/bridge/bridge-swap) → lib/defi/normalize.ts (isolated)
 *
 * Benefits:
 * - Zero coupling between Transfer and DeFi domains
 * - Independent evolution and testing
 * - Clear separation of concerns
 *
 * @see lib/transfer/normalize.ts for Transfer implementation
 * @see lib/defi/normalize.ts for DeFi implementation
 */
export async function normalizeIntent(
  intentSuccess: IntentSuccess,
  opts?: { preferredChainId?: number; senderAddress?: `0x${string}` }
): Promise<NormalizedIntent> {
  const { intent } = intentSuccess;

  // Route transfers to isolated transfer module
  if (intent.action === "transfer") {
    console.log("🔀 [Normalize Router] → Transfer module");
    return await normalizeTransferIntent(intent, opts);
  }

  // Route DeFi operations to isolated DeFi module
  if (intent.action === "swap" || intent.action === "bridge" || intent.action === "bridge_swap") {
    console.log(`🔀 [Normalize Router] → DeFi module (${intent.action})`);
    const { normalizeDeFiIntent } = await import("./defi/normalize");
    return await normalizeDeFiIntent(intent as any, opts);
  }

  throw new NormalizationError(
    `Action ${(intent as any).action} not supported.`,
    "ACTION_UNSUPPORTED"
  );
}

/**
 * Resolve MAX amount with actual balance
 */
export function resolveMaxAmount(
  norm: NormalizedNativeTransfer,
  balance: bigint,
  gasEstimate: bigint,
): NormalizedNativeTransfer {
  const gasHeadroom = gasEstimate * 110n / 100n; // 110% gas buffer
  const maxAmount = balance > gasHeadroom ? balance - gasHeadroom : 0n;

  if (maxAmount <= 0n) {
    throw new NormalizationError(
      "Insufficient balance for MAX transfer after gas headroom",
      "INSUFFICIENT_BALANCE_FOR_MAX"
    );
  }

  return {
    ...norm,
    amountWei: maxAmount,
  };
}
