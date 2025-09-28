// lib/normalize.ts - Intent normalization layer

import { parseEther, parseUnits, isAddress, getAddress } from "viem";
import type { IntentSuccess, TransferIntent } from "./ai";
import { resolveTokenSymbol, type Token } from "./tokens";
import { resolveChain, isChainSupported, getChainConfig } from "./chains/registry";
import { LifiApiClient, type TokenSearchResponse } from "./api-client";

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

export type NormalizedIntent = NormalizedNativeTransfer | NormalizedERC20Transfer;

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
 * Normalize transfer intent to internal format (Enhanced with LI.FI)
 */
export function normalizeTransferIntent(intent: TransferIntent): NormalizedIntent {
  // Check if we have a selected token with a specific chainId (from token selection flow)
  const selectedToken = (intent as any)._selectedToken;

  // Use the token's chainId if available, otherwise resolve from intent.chain
  const chainId = selectedToken?.chainId || resolveChainForNormalization(intent.chain);

  // Validate chain is supported
  if (!isChainSupported(chainId)) {
    const chainConfig = getChainConfig(chainId);
    const chainName = chainConfig?.name || `Chain ${chainId}`;
    throw new NormalizationError(
      `Chain ${chainName} (${chainId}) is not supported. Use '/chain list' to see supported chains.`,
      "CHAIN_UNSUPPORTED"
    );
  }

  // Validate and normalize recipient address
  if (!intent.recipient || typeof intent.recipient !== "string") {
    throw new NormalizationError(
      "Recipient address is required",
      "ADDRESS_REQUIRED"
    );
  }

  // Handle ENS names (future enhancement - for now reject)
  if (intent.recipient.endsWith(".eth")) {
    throw new NormalizationError(
      "ENS names not supported yet. Please use 0x address",
      "ENS_NOT_SUPPORTED"
    );
  }

  // Validate address format
  if (!isAddress(intent.recipient)) {
    throw new NormalizationError(
      "Recipient must be a valid checksummed 0x address",
      "ADDRESS_INVALID"
    );
  }

  // Checksum the address
  const to = getAddress(intent.recipient) as `0x${string}`;

  // Validate and parse amount
  if (!intent.amount || typeof intent.amount !== "string") {
    throw new NormalizationError(
      "Amount is required",
      "AMOUNT_REQUIRED"
    );
  }

  // Handle MAX amount (will be resolved during validation with balance check)
  if (intent.amount === "MAX") {
    throw new NormalizationError(
      "MAX amount resolution requires balance check during validation",
      "MAX_AMOUNT_NEEDS_VALIDATION"
    );
  }

  // Handle token resolution
  if (intent.token.type === "native") {
    // Native token transfer - validate symbol matches chain's native currency
    const chainConfig = getChainConfig(chainId);
    if (!chainConfig) {
      throw new NormalizationError(
        `Chain configuration not found for chain ${chainId}`,
        "CHAIN_CONFIG_MISSING"
      );
    }

    if (intent.token.symbol !== chainConfig.nativeCurrency.symbol) {
      throw new NormalizationError(
        `Native token '${intent.token.symbol}' is not valid for ${chainConfig.name}. Expected '${chainConfig.nativeCurrency.symbol}'`,
        "NATIVE_TOKEN_MISMATCH"
      );
    }

    // Parse amount to wei using the chain's native currency decimals
    let amountWei: bigint;
    try {
      const amountNumber = parseFloat(intent.amount);
      if (isNaN(amountNumber) || amountNumber <= 0) {
        throw new Error("Invalid amount");
      }
      amountWei = parseUnits(intent.amount, chainConfig.nativeCurrency.decimals);
    } catch {
      throw new NormalizationError(
        `Invalid amount: ${intent.amount}. Must be a positive decimal number`,
        "AMOUNT_INVALID"
      );
    }

    return {
      kind: "native-transfer",
      chainId,
      to,
      amountWei,
    };
  } else {
    // ERC-20 token transfer
    let token: Token;

    // Check if we have pre-selected token data (from token selection flow)
    if ((intent as any)._selectedToken) {
      const selectedToken = (intent as any)._selectedToken;
      token = {
        id: selectedToken.id,
        chainId: selectedToken.chainId,
        address: selectedToken.address as `0x${string}`,
        name: selectedToken.name,
        symbol: selectedToken.symbol,
        decimals: 18, // Default for ARB, will be validated later
        logoURI: selectedToken.logoURI,
        verified: selectedToken.verified,
      };
    } else {
      // Normal token resolution path
      const tokenResolution = resolveTokenSymbol(intent.token.symbol, chainId);

      if (tokenResolution.needsSelection) {
        // Multiple tokens found - throw TokenSelectionError
        throw new TokenSelectionError(
          tokenResolution.message,
          "TOKEN_SELECTION_REQUIRED",
          tokenResolution.tokens
        );
      }

      token = tokenResolution.token;
    }

    // Parse amount with token decimals
    let amountWei: bigint;
    try {
      const amountNumber = parseFloat(intent.amount);
      if (isNaN(amountNumber) || amountNumber <= 0) {
        throw new Error("Invalid amount");
      }
      amountWei = parseUnits(intent.amount, token.decimals);
    } catch {
      throw new NormalizationError(
        `Invalid amount: ${intent.amount}. Must be a positive decimal number`,
        "AMOUNT_INVALID"
      );
    }

    // Handle native token as ERC-20 (when user specifies "eth" as ERC-20)
    if (token.address === "0x0000000000000000000000000000000000000000") {
      return {
        kind: "native-transfer",
        chainId,
        to,
        amountWei,
      };
    }

    return {
      kind: "erc20-transfer",
      chainId,
      to,
      token: {
        address: token.address as `0x${string}`,
        symbol: token.symbol,
        decimals: token.decimals,
      },
      amountWei,
    };
  }
}

/**
 * Main normalization function - handles all intent types
 */
export function normalizeIntent(intentSuccess: IntentSuccess): NormalizedIntent {
  const { intent } = intentSuccess;

  if (intent.action === "transfer") {
    return normalizeTransferIntent(intent);
  }

  // Future: handle swap, bridge, bridge_swap
  throw new NormalizationError(
    `Action ${(intent as any).action} not supported in MVP. Only 'transfer' is supported.`,
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