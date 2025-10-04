// lib/transfer/normalize.ts - Transfer-specific normalization (isolated from DeFi)

import { parseUnits, isAddress, getAddress } from "viem";
import type { TransferIntent, NormalizedTransfer } from "./types";
import { TransferNormalizationError, TransferTokenSelectionError } from "./errors";
import { resolveAddressOrEns, isEnsName } from "../ens";
import { resolveChain, isChainSupported, getChainConfig } from "../chains/registry";
import { TokenApiClient, type MultiProviderSearchRequest, type TokenSearchResponse } from "../api-client";
import type { Token } from "../tokens";
import { parseIntentUSDAmount, isUSDBasedIntent } from "../ai/schema";
import { convertUSDToToken } from "../utils/usd-converter";

/**
 * Resolve chain name to chainId
 * TRANSFER-SPECIFIC: Simple chain resolution without complex cross-chain logic
 */
function resolveTransferChain(chain: string | number): number {
  try {
    const chainConfig = resolveChain(chain);
    return chainConfig.id;
  } catch (error) {
    throw new TransferNormalizationError(
      error instanceof Error ? error.message : `Unsupported chain: ${chain}`,
      "CHAIN_UNSUPPORTED"
    );
  }
}

/**
 * Enhanced multi-provider token resolution for transfers
 * Uses the unified token system for better coverage
 */
async function resolveTransferToken(
  symbol: string,
  chainId: number
): Promise<{
  needsSelection: boolean;
  tokens: TokenSearchResponse['tokens'];
  message?: string;
}> {
  try {
    console.log(`🔍 [Transfer] Multi-provider token resolution for '${symbol}' on chain ${chainId}`);

    // Build multi-provider search request (chain-specific for transfers)
    const searchRequest: MultiProviderSearchRequest = {
      symbol: symbol.toUpperCase(),
      chainIds: [chainId], // CRITICAL: Transfer only searches on the intent chain
      limit: 50,
      deduplicate: true,
      sortBy: 'confidence',
      sortOrder: 'desc',
      includeMetadata: true,
      includeHealth: false,
    };

    const searchResult = await TokenApiClient.searchTokensMultiProvider(searchRequest);

    if (!searchResult.success || searchResult.tokens.length === 0) {
      return {
        needsSelection: false,
        tokens: [],
        message: `Token '${symbol}' not found on chain ${chainId}`
      };
    }

    // Convert to compatible format
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

    // Filter for exact matches
    const searchSymbol = symbol.toLowerCase();
    const exactMatches = compatibleTokens.filter(
      token => token.symbol.toLowerCase() === searchSymbol
    );

    // Partial matches
    const partialMatches = compatibleTokens.filter(
      token => {
        const tokenSymbol = token.symbol.toLowerCase();
        return tokenSymbol !== searchSymbol && tokenSymbol.includes(searchSymbol);
      }
    );

    const relevantMatches = [
      ...exactMatches,
      ...partialMatches.slice(0, Math.max(0, 20 - exactMatches.length))
    ];

    if (relevantMatches.length === 0) {
      return {
        needsSelection: false,
        tokens: [],
        message: `No matches found for token '${symbol}' on chain ${chainId}`
      };
    }

    const providersUsed = searchResult.metadata.providersSuccessful;
    const providerCount = providersUsed.length;

    console.log(`✅ [Transfer] Found ${relevantMatches.length} matches from ${providerCount} providers`);

    // Single match - return directly
    if (relevantMatches.length === 1) {
      return {
        needsSelection: false,
        tokens: relevantMatches,
        message: `Found via ${providerCount} provider${providerCount > 1 ? 's' : ''}`,
      };
    }

    // Multiple matches - needs selection
    const exactCount = exactMatches.length;
    const partialCount = partialMatches.length;

    const matchDescription = exactCount > 0 && partialCount > 0
      ? `${exactCount} exact and ${partialCount} related '${symbol}' tokens`
      : exactCount > 0
        ? `Multiple '${symbol}' tokens`
        : `${partialCount} '${symbol}'-related tokens`;

    return {
      needsSelection: true,
      tokens: relevantMatches,
      message: `${matchDescription} found on chain ${chainId}. Please select one:`,
    };

  } catch (error) {
    console.warn("[Transfer] Token resolution failed:", error);
    throw new TransferNormalizationError(
      `Token resolution failed for '${symbol}' on chain ${chainId}`,
      "TOKEN_RESOLUTION_FAILED"
    );
  }
}

/**
 * Normalize transfer intent
 * CRITICAL FIX: Always uses chain from intent, never current chain
 */
export async function normalizeTransferIntent(
  intent: TransferIntent
): Promise<NormalizedTransfer> {
  console.log("🔄 [Transfer] Normalizing transfer intent:", intent);

  // Step 1: Resolve chain (ALWAYS from intent, never from current context)
  // BUG FIX: This was the issue - old code used preferredChainId from context
  const chainId = resolveTransferChain(intent.chain);

  // Validate chain is supported
  if (!isChainSupported(chainId)) {
    const chainConfig = getChainConfig(chainId);
    const chainName = chainConfig?.name || `Chain ${chainId}`;
    throw new TransferNormalizationError(
      `Chain ${chainName} (${chainId}) is not supported`,
      "CHAIN_UNSUPPORTED"
    );
  }

  console.log(`✅ [Transfer] Resolved chain to ${chainId}`);

  // Step 2: Validate and resolve recipient
  if (!intent.recipient || typeof intent.recipient !== "string") {
    throw new TransferNormalizationError(
      "Recipient address is required",
      "ADDRESS_REQUIRED"
    );
  }

  // Resolve ENS if present
  let recipientAddress: string;
  if (isEnsName(intent.recipient)) {
    try {
      recipientAddress = await resolveAddressOrEns(intent.recipient);
      console.log(`✅ [Transfer] Resolved ENS '${intent.recipient}' to ${recipientAddress}`);
    } catch (error) {
      throw new TransferNormalizationError(
        `Could not resolve ENS name: ${intent.recipient}`,
        "ENS_RESOLUTION_FAILED"
      );
    }
  } else {
    recipientAddress = intent.recipient;
  }

  // Validate address format
  if (!isAddress(recipientAddress)) {
    throw new TransferNormalizationError(
      "Recipient must be a valid 0x address or ENS name",
      "ADDRESS_INVALID"
    );
  }

  const to = getAddress(recipientAddress) as `0x${string}`;

  // Step 3: Validate and convert amount
  let transferAmount: string;

  // Check if USD-based amount
  if (isUSDBasedIntent(intent as any) && intent.amountUSD) {
    console.log(`💵 [Transfer] Converting USD amount: ${intent.amountUSD}`);
    
    try {
      const usdAmount = parseIntentUSDAmount(intent.amountUSD);
      
      // Determine token symbol for conversion
      const tokenSymbol = intent.token.type === "native" 
        ? getChainConfig(chainId)?.nativeCurrency.symbol || "ETH"
        : intent.token.symbol;
      
      // Convert USD to token amount
      const tokenAmount = await convertUSDToToken(usdAmount, tokenSymbol, chainId);
      transferAmount = tokenAmount;
      
      console.log(`✅ [Transfer] Converted ${intent.amountUSD} → ${tokenAmount} ${tokenSymbol}`);
    } catch (error) {
      throw new TransferNormalizationError(
        `Failed to convert USD amount: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "USD_CONVERSION_FAILED"
      );
    }
  } else if (intent.amount) {
    // Traditional token amount
    if (intent.amount === "MAX") {
      throw new TransferNormalizationError(
        "MAX amount resolution requires balance check during validation",
        "MAX_AMOUNT_NEEDS_VALIDATION"
      );
    }
    transferAmount = intent.amount;
  } else {
    throw new TransferNormalizationError(
      "Amount or amountUSD is required",
      "AMOUNT_REQUIRED"
    );
  }

  // Step 4: Handle token resolution
  if (intent.token.type === "native") {
    // Native token transfer
    const chainConfig = getChainConfig(chainId);
    if (!chainConfig) {
      throw new TransferNormalizationError(
        `Chain configuration not found for chain ${chainId}`,
        "CHAIN_CONFIG_MISSING"
      );
    }

    // Validate symbol matches chain's native currency
    if (intent.token.symbol !== chainConfig.nativeCurrency.symbol) {
      throw new TransferNormalizationError(
        `Native token '${intent.token.symbol}' is not valid for ${chainConfig.name}. Expected '${chainConfig.nativeCurrency.symbol}'`,
        "NATIVE_TOKEN_MISMATCH"
      );
    }

    // Parse amount to wei
    let amountWei: bigint;
    try {
      const amountNumber = parseFloat(transferAmount);
      if (isNaN(amountNumber) || amountNumber <= 0) {
        throw new Error("Invalid amount");
      }
      amountWei = parseUnits(transferAmount, chainConfig.nativeCurrency.decimals);
    } catch {
      throw new TransferNormalizationError(
        `Invalid amount: ${transferAmount}. Must be a positive decimal number`,
        "AMOUNT_INVALID"
      );
    }

    console.log(`✅ [Transfer] Normalized native transfer: ${intent.amount} ${intent.token.symbol} on chain ${chainId}`);

    return {
      kind: "native-transfer",
      chainId,
      to,
      amountWei,
    };

  } else {
    // ERC-20 token transfer
    let token: Token;

    // Check if we have pre-selected token (from token selection flow)
    if ((intent as any)._selectedToken) {
      const selectedToken = (intent as any)._selectedToken;
      token = {
        id: selectedToken.id,
        chainId: selectedToken.chainId,
        address: selectedToken.address as `0x${string}`,
        name: selectedToken.name,
        symbol: selectedToken.symbol,
        decimals: selectedToken.decimals || 18,
        logoURI: selectedToken.logoURI,
        verified: selectedToken.verified,
      };
      console.log(`✅ [Transfer] Using pre-selected token:`, token);
    } else {
      // Resolve token on the intent chain
      const tokenResolution = await resolveTransferToken(intent.token.symbol, chainId);

      if (tokenResolution.needsSelection) {
        // Multiple tokens - throw selection error
        const compatibleTokens: Token[] = tokenResolution.tokens.map((token, index) => ({
          id: index + 1,
          chainId: token.chainId,
          address: token.address as `0x${string}`,
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals,
          logoURI: token.logoURI,
          verified: token.verified || false,
        }));

        throw new TransferTokenSelectionError(
          tokenResolution.message || `Multiple '${intent.token.symbol}' tokens found. Please select one:`,
          compatibleTokens
        );
      }

      if (tokenResolution.tokens.length === 0) {
        throw new TransferNormalizationError(
          tokenResolution.message || `Token '${intent.token.symbol}' not found on chain ${chainId}`,
          "TOKEN_NOT_FOUND"
        );
      }

      // Single token found
      const foundToken = tokenResolution.tokens[0];
      token = {
        id: 1,
        chainId: foundToken.chainId,
        address: foundToken.address as `0x${string}`,
        name: foundToken.name,
        symbol: foundToken.symbol,
        decimals: foundToken.decimals,
        logoURI: foundToken.logoURI,
        verified: foundToken.verified || false,
      };

      console.log(`✅ [Transfer] Resolved token:`, token);
    }

    // Parse amount with token decimals
    let amountWei: bigint;
    try {
      const amountNumber = parseFloat(transferAmount);
      if (isNaN(amountNumber) || amountNumber <= 0) {
        throw new Error("Invalid amount");
      }
      amountWei = parseUnits(transferAmount, token.decimals);
    } catch {
      throw new TransferNormalizationError(
        `Invalid amount: ${transferAmount}. Must be a positive decimal number`,
        "AMOUNT_INVALID"
      );
    }

    // Handle native token wrapped as ERC-20
    if (token.address === "0x0000000000000000000000000000000000000000") {
      return {
        kind: "native-transfer",
        chainId,
        to,
        amountWei,
      };
    }

    console.log(`✅ [Transfer] Normalized ERC-20 transfer: ${intent.amount} ${token.symbol} on chain ${chainId}`);

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
 * Resolve MAX amount with actual balance
 */
export function resolveMaxAmount(
  norm: NormalizedTransfer,
  balance: bigint,
  gasEstimate: bigint
): NormalizedTransfer {
  if (norm.kind !== "native-transfer") {
    throw new TransferNormalizationError(
      "MAX amount only supported for native transfers",
      "MAX_NOT_SUPPORTED"
    );
  }

  const gasHeadroom = gasEstimate * 110n / 100n; // 110% gas buffer
  const maxAmount = balance > gasHeadroom ? balance - gasHeadroom : 0n;

  if (maxAmount <= 0n) {
    throw new TransferNormalizationError(
      "Insufficient balance for MAX transfer after gas headroom",
      "INSUFFICIENT_BALANCE_FOR_MAX"
    );
  }

  return {
    ...norm,
    amountWei: maxAmount,
  };
}
