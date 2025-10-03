// lib/normalize.ts - Intent normalization layer

import { parseEther, parseUnits, isAddress, getAddress } from "viem";
import type { IntentSuccess, TransferIntent } from "./ai";
import { resolveTokenSymbol, type Token } from "./tokens";
import { resolveChain, isChainSupported, getChainConfig } from "./chains/registry";
import { LifiApiClient, TokenApiClient, type TokenSearchResponse, type MultiProviderSearchRequest } from "./api-client";
import type { MultiProviderTokenResponse, UnifiedToken } from "@/types/unified-token";
import { resolveAddressOrEns, isEnsName } from "./ens";

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
 * Normalize transfer intent to internal format (Enhanced with Multi-Provider)
 * USES ISOLATED TRANSFER SYSTEM (default behavior)
 */
export async function normalizeTransferIntent(
  intent: TransferIntent,
  opts?: { preferredChainId?: number }
): Promise<NormalizedIntent> {
  // Always use isolated transfer system (default behavior, no feature flag needed)
  const { normalizeTransferIntent: isolatedNormalize } = await import("./transfer/normalize");
  return await isolatedNormalize(intent);
}

/**
 * Normalize swap intent (same-chain token exchange)
 */
async function normalizeSwapIntent(
  intent: any,
  opts?: { preferredChainId?: number; senderAddress?: `0x${string}` }
): Promise<NormalizedSwap> {
  // Import type guards
  const { isSwapIntent } = await import("./ai/schema");
  if (!isSwapIntent(intent)) {
    throw new NormalizationError("Invalid swap intent", "INVALID_INTENT");
  }

  // Resolve chains
  const fromChainId = resolveChainForNormalization(intent.fromChain);
  const toChainId = intent.toChain ? resolveChainForNormalization(intent.toChain) : fromChainId;

  // For swaps, both chains must be the same
  if (fromChainId !== toChainId) {
    throw new NormalizationError(
      "Swap requires same chain. For cross-chain swaps, use bridge-swap.",
      "CHAIN_MISMATCH"
    );
  }

  // Check if we have pre-selected tokens from token selection flow
  const selectedFromToken = (intent as any)._selectedFromToken;
  const selectedToToken = (intent as any)._selectedToToken;

  console.log("🔍 Checking for pre-selected tokens:", {
    hasSelectedFromToken: !!selectedFromToken,
    hasSelectedToToken: !!selectedToToken,
    selectedFromToken,
    selectedToToken,
    fullIntent: intent
  });

  let fromToken: any;
  let toToken: any;

  // Resolve fromToken
  if (selectedFromToken) {
    // Use the pre-selected token for fromToken
    fromToken = {
      chainId: selectedFromToken.chainId,
      address: selectedFromToken.address,
      name: selectedFromToken.name,
      symbol: selectedFromToken.symbol,
      decimals: 18, // Will be resolved from token data
      logoURI: selectedFromToken.logoURI,
      verified: selectedFromToken.verified,
    };
  } else {
    const fromTokenResult = await resolveTokensMultiProvider(intent.fromToken, fromChainId);
    if (fromTokenResult.needsSelection) {
      const compatibleTokens = fromTokenResult.tokens.map((token, index) => ({
        id: index + 1,
        chainId: token.chainId,
        address: token.address as `0x${string}`,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        logoURI: token.logoURI,
        verified: token.verified || false,
      }));
      throw new TokenSelectionError(
        fromTokenResult.message || `Multiple '${intent.fromToken}' tokens found. Please select one:`,
        "TOKEN_SELECTION_REQUIRED",
        compatibleTokens
      );
    }

    if (fromTokenResult.tokens.length === 0) {
      throw new NormalizationError(
        `Token '${intent.fromToken}' not found on chain ${fromChainId}`,
        "TOKEN_NOT_FOUND"
      );
    }

    fromToken = fromTokenResult.tokens[0];
  }

  // Resolve toToken
  if (selectedToToken) {
    // Use the pre-selected token for toToken
    toToken = {
      chainId: selectedToToken.chainId,
      address: selectedToToken.address,
      name: selectedToToken.name,
      symbol: selectedToToken.symbol,
      decimals: 18, // Will be resolved from token data
      logoURI: selectedToToken.logoURI,
      verified: selectedToToken.verified,
    };
  } else {
    const toTokenResult = await resolveTokensMultiProvider(intent.toToken, toChainId);
    if (toTokenResult.needsSelection) {
      const compatibleTokens = toTokenResult.tokens.map((token, index) => ({
        id: index + 1,
        chainId: token.chainId,
        address: token.address as `0x${string}`,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        logoURI: token.logoURI,
        verified: token.verified || false,
      }));
      throw new TokenSelectionError(
        toTokenResult.message || `Multiple '${intent.toToken}' tokens found. Please select one:`,
        "TOKEN_SELECTION_REQUIRED",
        compatibleTokens
      );
    }

    if (toTokenResult.tokens.length === 0) {
      throw new NormalizationError(
        `Token '${intent.toToken}' not found on chain ${toChainId}`,
        "TOKEN_NOT_FOUND"
      );
    }

    toToken = toTokenResult.tokens[0];
  }

  // Parse amount
  const fromAmount = parseUnits(intent.amount, fromToken.decimals);

  // Resolve recipient (ENS, address, or default to sender)
  let recipient: `0x${string}` | undefined;

  if (intent.recipient) {
    if (isEnsName(intent.recipient)) {
      try {
        const resolved = await resolveAddressOrEns(intent.recipient);
        recipient = getAddress(resolved);
        console.log(`✅ Resolved swap recipient ENS '${intent.recipient}' to ${recipient}`);
      } catch (error) {
        throw new NormalizationError(
          `Could not resolve ENS name for recipient: ${intent.recipient}`,
          "ENS_RESOLUTION_FAILED"
        );
      }
    } else if (isAddress(intent.recipient)) {
      recipient = getAddress(intent.recipient);
    } else {
      recipient = opts?.senderAddress;
    }
  } else {
    recipient = opts?.senderAddress;
  }

  if (!recipient) {
    throw new NormalizationError(
      "Recipient address is required for swap",
      "RECIPIENT_REQUIRED"
    );
  }

  return {
    kind: "swap",
    fromChainId,
    toChainId,
    fromToken: {
      address: fromToken.address as `0x${string}`,
      symbol: fromToken.symbol,
      decimals: fromToken.decimals,
    },
    toToken: {
      address: toToken.address as `0x${string}`,
      symbol: toToken.symbol,
      decimals: toToken.decimals,
    },
    fromAmount,
    recipient,
  };
}

/**
 * Normalize bridge intent (same token cross-chain transfer)
 */
async function normalizeBridgeIntent(
  intent: any,
  opts?: { preferredChainId?: number; senderAddress?: `0x${string}` }
): Promise<NormalizedBridge> {
  const { isBridgeIntent } = await import("./ai/schema");
  if (!isBridgeIntent(intent)) {
    throw new NormalizationError("Invalid bridge intent", "INVALID_INTENT");
  }

  // Resolve chains
  const fromChainId = resolveChainForNormalization(intent.fromChain);
  const toChainId = resolveChainForNormalization(intent.toChain);

  // For bridges, chains must be different
  if (fromChainId === toChainId) {
    throw new NormalizationError(
      "Bridge requires different chains. For same-chain transfers, use transfer or swap.",
      "CHAIN_MISMATCH"
    );
  }

  // Resolve token on source chain
  const tokenResult = await resolveTokensMultiProvider(intent.token, fromChainId);
  if (tokenResult.needsSelection) {
    const compatibleTokens = tokenResult.tokens.map((token, index) => ({
      id: index + 1,
      chainId: token.chainId,
      address: token.address as `0x${string}`,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      logoURI: token.logoURI,
      verified: token.verified || false,
    }));
    throw new TokenSelectionError(
      tokenResult.message || `Multiple '${intent.token}' tokens found. Please select one:`,
      "TOKEN_SELECTION_REQUIRED",
      compatibleTokens
    );
  }

  if (tokenResult.tokens.length === 0) {
    throw new NormalizationError(
      `Token '${intent.token}' not found on chain ${fromChainId}`,
      "TOKEN_NOT_FOUND"
    );
  }

  const token = tokenResult.tokens[0];

  // Parse amount
  const amount = parseUnits(intent.amount, token.decimals);

  // Resolve recipient (ENS, address, or default to sender)
  let recipient: `0x${string}` | undefined;

  if (intent.recipient) {
    if (isEnsName(intent.recipient)) {
      try {
        const resolved = await resolveAddressOrEns(intent.recipient);
        recipient = getAddress(resolved);
        console.log(`✅ Resolved bridge recipient ENS '${intent.recipient}' to ${recipient}`);
      } catch (error) {
        throw new NormalizationError(
          `Could not resolve ENS name for recipient: ${intent.recipient}`,
          "ENS_RESOLUTION_FAILED"
        );
      }
    } else if (isAddress(intent.recipient)) {
      recipient = getAddress(intent.recipient);
    } else {
      recipient = opts?.senderAddress;
    }
  } else {
    recipient = opts?.senderAddress;
  }

  if (!recipient) {
    throw new NormalizationError(
      "Recipient address is required for bridge",
      "RECIPIENT_REQUIRED"
    );
  }

  return {
    kind: "bridge",
    fromChainId,
    toChainId,
    token: {
      address: token.address as `0x${string}`,
      symbol: token.symbol,
      decimals: token.decimals,
    },
    amount,
    recipient,
  };
}

/**
 * Normalize bridge-swap intent (cross-chain token exchange)
 */
async function normalizeBridgeSwapIntent(
  intent: any,
  opts?: { preferredChainId?: number; senderAddress?: `0x${string}` }
): Promise<NormalizedBridgeSwap> {
  const { isBridgeSwapIntent } = await import("./ai/schema");
  if (!isBridgeSwapIntent(intent)) {
    throw new NormalizationError("Invalid bridge-swap intent", "INVALID_INTENT");
  }

  // Resolve chains
  const fromChainId = resolveChainForNormalization(intent.fromChain);
  const toChainId = resolveChainForNormalization(intent.toChain);

  // For bridge-swaps, chains must be different
  if (fromChainId === toChainId) {
    throw new NormalizationError(
      "Bridge-swap requires different chains. For same-chain swaps, use swap.",
      "CHAIN_MISMATCH"
    );
  }

  // Resolve tokens
  const fromTokenResult = await resolveTokensMultiProvider(intent.fromToken, fromChainId);
  if (fromTokenResult.needsSelection) {
    const compatibleTokens = fromTokenResult.tokens.map((token, index) => ({
      id: index + 1,
      chainId: token.chainId,
      address: token.address as `0x${string}`,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      logoURI: token.logoURI,
      verified: token.verified || false,
    }));
    throw new TokenSelectionError(
      fromTokenResult.message || `Multiple '${intent.fromToken}' tokens found. Please select one:`,
      "TOKEN_SELECTION_REQUIRED",
      compatibleTokens
    );
  }

  if (fromTokenResult.tokens.length === 0) {
    throw new NormalizationError(
      `Token '${intent.fromToken}' not found on chain ${fromChainId}`,
      "TOKEN_NOT_FOUND"
    );
  }

  const toTokenResult = await resolveTokensMultiProvider(intent.toToken, toChainId);
  if (toTokenResult.needsSelection) {
    const compatibleTokens = toTokenResult.tokens.map((token, index) => ({
      id: index + 1,
      chainId: token.chainId,
      address: token.address as `0x${string}`,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      logoURI: token.logoURI,
      verified: token.verified || false,
    }));
    throw new TokenSelectionError(
      toTokenResult.message || `Multiple '${intent.toToken}' tokens found. Please select one:`,
      "TOKEN_SELECTION_REQUIRED",
      compatibleTokens
    );
  }

  if (toTokenResult.tokens.length === 0) {
    throw new NormalizationError(
      `Token '${intent.toToken}' not found on chain ${toChainId}`,
      "TOKEN_NOT_FOUND"
    );
  }

  const fromToken = fromTokenResult.tokens[0];
  const toToken = toTokenResult.tokens[0];

  // Parse amount
  const fromAmount = parseUnits(intent.amount, fromToken.decimals);

  // Resolve recipient (ENS, address, or default to sender)
  let recipient: `0x${string}` | undefined;

  if (intent.recipient) {
    if (isEnsName(intent.recipient)) {
      try {
        const resolved = await resolveAddressOrEns(intent.recipient);
        recipient = getAddress(resolved);
        console.log(`✅ Resolved bridge-swap recipient ENS '${intent.recipient}' to ${recipient}`);
      } catch (error) {
        throw new NormalizationError(
          `Could not resolve ENS name for recipient: ${intent.recipient}`,
          "ENS_RESOLUTION_FAILED"
        );
      }
    } else if (isAddress(intent.recipient)) {
      recipient = getAddress(intent.recipient);
    } else {
      recipient = opts?.senderAddress;
    }
  } else {
    recipient = opts?.senderAddress;
  }

  if (!recipient) {
    throw new NormalizationError(
      "Recipient address is required for bridge-swap",
      "RECIPIENT_REQUIRED"
    );
  }

  return {
    kind: "bridge-swap",
    fromChainId,
    toChainId,
    fromToken: {
      address: fromToken.address as `0x${string}`,
      symbol: fromToken.symbol,
      decimals: fromToken.decimals,
    },
    toToken: {
      address: toToken.address as `0x${string}`,
      symbol: toToken.symbol,
      decimals: toToken.decimals,
    },
    fromAmount,
    recipient,
  };
}

/**
 * Main normalization function - handles all intent types (Enhanced with Multi-Provider)
 */
export async function normalizeIntent(
  intentSuccess: IntentSuccess,
  opts?: { preferredChainId?: number; senderAddress?: `0x${string}` }
): Promise<NormalizedIntent> {
  const { intent } = intentSuccess;

  // ✅ ISOLATED TRANSFER SYSTEM - Route transfers to isolated transfer module
  if (intent.action === "transfer") {
    console.log("🔀 [Main Normalize] Routing to isolated transfer system");
    return await normalizeTransferIntent(intent, opts);
  }

  // ✅ ISOLATED DEFI SYSTEM - Route DeFi operations to isolated DeFi module
  if (intent.action === "swap" || intent.action === "bridge" || intent.action === "bridge_swap") {
    console.log(`🔀 [Main Normalize] Routing ${intent.action} to isolated DeFi system`);
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
