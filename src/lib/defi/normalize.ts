// lib/defi/normalize.ts - DeFi-specific normalization

import { parseUnits, isAddress, getAddress, createPublicClient, http } from "viem";
import type { SwapIntent, BridgeIntent, BridgeSwapIntent, NormalizedSwap, NormalizedBridge, NormalizedBridgeSwap, NormalizedDeFi } from "./types";
import { DeFiNormalizationError, DeFiTokenSelectionError } from "./errors";
import { resolveChain, getChainConfig } from "@/lib/chains/registry";
import { resolveTokensMultiProvider } from "@/lib/normalize";
import { resolveAddressOrEns, isEnsName } from "@/lib/ens";
import { isUSDBasedIntent, parseIntentUSDAmount } from "@/lib/ai/schema";
import { convertUSDToToken } from "@/lib/utils/usd-converter";
import { verifyTokenDecimals } from "@/lib/utils/tokenDecimals";

/**
 * Helper: Verify token decimals on-chain for DeFi operations
 * Returns verified decimals, skips native tokens (0x0000...)
 */
async function verifyDeFiTokenDecimals(
  token: any,
  chainId: number
): Promise<number> {
  // Skip verification for native tokens
  if (token.address === "0x0000000000000000000000000000000000000000") {
    const chainConfig = getChainConfig(chainId);
    return chainConfig?.nativeCurrency.decimals || 18;
  }

  // Get public client
  const chainConfig = getChainConfig(chainId);
  if (!chainConfig) {
    throw new DeFiNormalizationError(
      `Chain configuration not found for chain ${chainId}`,
      "CHAIN_CONFIG_MISSING"
    );
  }

  const publicClient = createPublicClient({
    chain: chainConfig.wagmiChain,
    transport: http(chainConfig.rpcUrl),
  });

  // Verify decimals on-chain
  const expectedDecimals = token.decimals || 18;
  const verification = await verifyTokenDecimals(
    token.address as `0x${string}`,
    expectedDecimals,
    chainId,
    publicClient
  );

  if (verification.mismatch) {
    console.warn(
      `⚠️ [DeFi] Decimal mismatch for ${token.symbol}:`,
      `Expected: ${expectedDecimals}, Actual: ${verification.actualDecimals}`
    );
  }

  return verification.actualDecimals;
}

/**
 * Normalize DeFi intent (swap/bridge/bridge-swap)
 * IMPORTANT: This function is ONLY for DeFi operations - no transfer logic
 */
export async function normalizeDeFiIntent(
  intent: SwapIntent | BridgeIntent | BridgeSwapIntent,
  opts?: { senderAddress?: `0x${string}` }
): Promise<NormalizedDeFi> {
  console.log(`🔄 [DeFi] Normalizing ${intent.action} intent`);

  if (intent.action === "swap") {
    return await normalizeSwapIntent(intent as SwapIntent, opts);
  } else if (intent.action === "bridge") {
    return await normalizeBridgeIntent(intent as BridgeIntent, opts);
  } else if (intent.action === "bridge_swap") {
    return await normalizeBridgeSwapIntent(intent as BridgeSwapIntent, opts);
  }

  throw new DeFiNormalizationError(
    `Unknown DeFi action: ${(intent as any).action}`,
    "UNKNOWN_ACTION"
  );
}

/**
 * Normalize swap intent
 * DEFI-SPECIFIC: Handles token pair resolution and slippage
 */
async function normalizeSwapIntent(
  intent: SwapIntent,
  opts?: { senderAddress?: `0x${string}` }
): Promise<NormalizedSwap> {
  console.log("🔄 [DeFi] Normalizing swap intent");

  // Resolve chains
  const fromChainConfig = resolveChain(intent.fromChain);
  const toChainConfig = resolveChain(intent.toChain || intent.fromChain);

  const fromChainId = fromChainConfig.id;
  const toChainId = toChainConfig.id;

  // Validate same-chain swap
  if (fromChainId !== toChainId) {
    throw new DeFiNormalizationError(
      "Swap requires same chain. Use bridge-swap for cross-chain",
      "CHAIN_MISMATCH"
    );
  }

  // Resolve tokens (check for pre-selected tokens from token selection flow)
  const selectedFromToken = intent._selectedFromToken;
  const selectedToToken = intent._selectedToToken;

  let fromToken: any;
  let toToken: any;

  // Resolve fromToken
  if (selectedFromToken) {
    const verifiedDecimals = await verifyDeFiTokenDecimals(selectedFromToken, fromChainId);
    fromToken = {
      address: selectedFromToken.address,
      symbol: selectedFromToken.symbol,
      decimals: verifiedDecimals,
    };
  } else {
    const fromTokenResult = await resolveTokensMultiProvider(intent.fromToken, fromChainId);
    if (fromTokenResult.needsSelection) {
      const compatibleTokens = fromTokenResult.tokens.map((token, index) => ({
        id: index + 1,
        chainId: token.chainId,
        address: token.address as string,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        logoURI: token.logoURI,
        verified: token.verified || false,
      }));
      throw new DeFiTokenSelectionError(
        fromTokenResult.message || `Multiple '${intent.fromToken}' tokens found. Please select one:`,
        compatibleTokens,
        "from"
      );
    }

    if (fromTokenResult.tokens.length === 0) {
      throw new DeFiNormalizationError(
        `Token '${intent.fromToken}' not found on chain ${fromChainId}`,
        "TOKEN_NOT_FOUND"
      );
    }

    const resolvedFromToken = fromTokenResult.tokens[0];
    const verifiedFromDecimals = await verifyDeFiTokenDecimals(resolvedFromToken, fromChainId);
    fromToken = {
      ...resolvedFromToken,
      decimals: verifiedFromDecimals,
    };
  }

  // Resolve toToken
  if (selectedToToken) {
    const verifiedDecimals = await verifyDeFiTokenDecimals(selectedToToken, toChainId);
    toToken = {
      address: selectedToToken.address,
      symbol: selectedToToken.symbol,
      decimals: verifiedDecimals,
    };
  } else {
    const toTokenResult = await resolveTokensMultiProvider(intent.toToken, toChainId);
    if (toTokenResult.needsSelection) {
      const compatibleTokens = toTokenResult.tokens.map((token, index) => ({
        id: index + 1,
        chainId: token.chainId,
        address: token.address as string,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        logoURI: token.logoURI,
        verified: token.verified || false,
      }));
      throw new DeFiTokenSelectionError(
        toTokenResult.message || `Multiple '${intent.toToken}' tokens found. Please select one:`,
        compatibleTokens,
        "to"
      );
    }

    if (toTokenResult.tokens.length === 0) {
      throw new DeFiNormalizationError(
        `Token '${intent.toToken}' not found on chain ${toChainId}`,
        "TOKEN_NOT_FOUND"
      );
    }

    const resolvedToToken = toTokenResult.tokens[0];
    const verifiedToDecimals = await verifyDeFiTokenDecimals(resolvedToToken, toChainId);
    toToken = {
      ...resolvedToToken,
      decimals: verifiedToDecimals,
    };
  }

  // Parse amount (handle USD or token amount)
  let swapAmount: string;
  
  if (isUSDBasedIntent(intent as any) && intent.amountUSD) {
    console.log(`💵 [DeFi] Converting USD amount for swap: ${intent.amountUSD}`);
    
    try {
      const usdAmount = parseIntentUSDAmount(intent.amountUSD);
      const tokenAmount = await convertUSDToToken(usdAmount, fromToken.symbol, fromChainId);
      swapAmount = tokenAmount;
      
      console.log(`✅ [DeFi] Converted ${intent.amountUSD} → ${tokenAmount} ${fromToken.symbol}`);
    } catch (error) {
      throw new DeFiNormalizationError(
        `Failed to convert USD amount for swap: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "USD_CONVERSION_FAILED"
      );
    }
  } else if (intent.amount) {
    swapAmount = intent.amount;
  } else {
    throw new DeFiNormalizationError(
      "Amount or amountUSD is required for swap",
      "AMOUNT_REQUIRED"
    );
  }

  const fromAmount = parseUnits(swapAmount, fromToken.decimals);

  // Resolve recipient (ENS, address, or default to sender)
  let recipient: `0x${string}` | undefined;

  if (intent.recipient) {
    if (isEnsName(intent.recipient)) {
      try {
        const resolved = await resolveAddressOrEns(intent.recipient);
        recipient = getAddress(resolved);
        console.log(`✅ [DeFi] Resolved swap recipient ENS '${intent.recipient}' to ${recipient}`);
      } catch (error) {
        throw new DeFiNormalizationError(
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
    throw new DeFiNormalizationError(
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
 * Normalize bridge intent
 * DEFI-SPECIFIC: Handles cross-chain token bridging
 */
async function normalizeBridgeIntent(
  intent: BridgeIntent,
  opts?: { senderAddress?: `0x${string}` }
): Promise<NormalizedBridge> {
  console.log("🔄 [DeFi] Normalizing bridge intent");

  // Resolve chains
  const fromChainConfig = resolveChain(intent.fromChain);
  const toChainConfig = resolveChain(intent.toChain);

  const fromChainId = fromChainConfig.id;
  const toChainId = toChainConfig.id;

  // Validate cross-chain bridge
  if (fromChainId === toChainId) {
    throw new DeFiNormalizationError(
      "Bridge requires different chains. Use transfer for same-chain",
      "SAME_CHAIN"
    );
  }

  // Resolve token (check for pre-selected token from token selection flow)
  const selectedToken = intent._selectedToken;

  let token: any;

  if (selectedToken) {
    const verifiedDecimals = await verifyDeFiTokenDecimals(selectedToken, fromChainId);
    token = {
      address: selectedToken.address,
      symbol: selectedToken.symbol,
      decimals: verifiedDecimals,
    };
  } else {
    const tokenResult = await resolveTokensMultiProvider(intent.token, fromChainId);
    if (tokenResult.needsSelection) {
      const compatibleTokens = tokenResult.tokens.map((token, index) => ({
        id: index + 1,
        chainId: token.chainId,
        address: token.address as string,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        logoURI: token.logoURI,
        verified: token.verified || false,
      }));
      throw new DeFiTokenSelectionError(
        tokenResult.message || `Multiple '${intent.token}' tokens found. Please select one:`,
        compatibleTokens,
        "bridge"
      );
    }

    if (tokenResult.tokens.length === 0) {
      throw new DeFiNormalizationError(
        `Token '${intent.token}' not found on chain ${fromChainId}`,
        "TOKEN_NOT_FOUND"
      );
    }

    const resolvedToken = tokenResult.tokens[0];
    const verifiedDecimals = await verifyDeFiTokenDecimals(resolvedToken, fromChainId);
    token = {
      ...resolvedToken,
      decimals: verifiedDecimals,
    };
  }

  // Parse amount (handle USD or token amount)
  let bridgeAmount: string;
  
  if (isUSDBasedIntent(intent as any) && intent.amountUSD) {
    console.log(`💵 [DeFi] Converting USD amount for bridge: ${intent.amountUSD}`);
    
    try {
      const usdAmount = parseIntentUSDAmount(intent.amountUSD);
      const tokenAmount = await convertUSDToToken(usdAmount, token.symbol, fromChainId);
      bridgeAmount = tokenAmount;
      
      console.log(`✅ [DeFi] Converted ${intent.amountUSD} → ${tokenAmount} ${token.symbol}`);
    } catch (error) {
      throw new DeFiNormalizationError(
        `Failed to convert USD amount for bridge: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "USD_CONVERSION_FAILED"
      );
    }
  } else if (intent.amount) {
    bridgeAmount = intent.amount;
  } else {
    throw new DeFiNormalizationError(
      "Amount or amountUSD is required for bridge",
      "AMOUNT_REQUIRED"
    );
  }

  const amount = parseUnits(bridgeAmount, token.decimals);

  // Resolve recipient
  let recipient: `0x${string}` | undefined;

  if (intent.recipient) {
    if (isEnsName(intent.recipient)) {
      try {
        const resolved = await resolveAddressOrEns(intent.recipient);
        recipient = getAddress(resolved);
        console.log(`✅ [DeFi] Resolved bridge recipient ENS '${intent.recipient}' to ${recipient}`);
      } catch (error) {
        throw new DeFiNormalizationError(
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
    throw new DeFiNormalizationError(
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
 * Normalize bridge-swap intent
 * DEFI-SPECIFIC: Handles cross-chain token exchange
 */
async function normalizeBridgeSwapIntent(
  intent: BridgeSwapIntent,
  opts?: { senderAddress?: `0x${string}` }
): Promise<NormalizedBridgeSwap> {
  console.log("🔄 [DeFi] Normalizing bridge-swap intent");

  // Resolve chains
  const fromChainConfig = resolveChain(intent.fromChain);
  const toChainConfig = resolveChain(intent.toChain);

  const fromChainId = fromChainConfig.id;
  const toChainId = toChainConfig.id;

  // Validate cross-chain
  if (fromChainId === toChainId) {
    throw new DeFiNormalizationError(
      "Bridge-swap requires different chains. Use swap for same-chain",
      "SAME_CHAIN"
    );
  }

  // Resolve tokens (similar to swap, but across chains)
  const selectedFromToken = intent._selectedFromToken;
  const selectedToToken = intent._selectedToToken;

  let fromToken: any;
  let toToken: any;

  // Resolve fromToken
  if (selectedFromToken) {
    const verifiedDecimals = await verifyDeFiTokenDecimals(selectedFromToken, fromChainId);
    fromToken = {
      address: selectedFromToken.address,
      symbol: selectedFromToken.symbol,
      decimals: verifiedDecimals,
    };
  } else {
    const fromTokenResult = await resolveTokensMultiProvider(intent.fromToken, fromChainId);
    if (fromTokenResult.needsSelection) {
      const compatibleTokens = fromTokenResult.tokens.map((token, index) => ({
        id: index + 1,
        chainId: token.chainId,
        address: token.address as string,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        logoURI: token.logoURI,
        verified: token.verified || false,
      }));
      throw new DeFiTokenSelectionError(
        fromTokenResult.message || `Multiple '${intent.fromToken}' tokens found. Please select one:`,
        compatibleTokens,
        "from"
      );
    }

    if (fromTokenResult.tokens.length === 0) {
      throw new DeFiNormalizationError(
        `Token '${intent.fromToken}' not found on chain ${fromChainId}`,
        "TOKEN_NOT_FOUND"
      );
    }

    const resolvedFromToken = fromTokenResult.tokens[0];
    const verifiedFromDecimals = await verifyDeFiTokenDecimals(resolvedFromToken, fromChainId);
    fromToken = {
      ...resolvedFromToken,
      decimals: verifiedFromDecimals,
    };
  }

  // Resolve toToken (on destination chain)
  if (selectedToToken) {
    const verifiedDecimals = await verifyDeFiTokenDecimals(selectedToToken, toChainId);
    toToken = {
      address: selectedToToken.address,
      symbol: selectedToToken.symbol,
      decimals: verifiedDecimals,
    };
  } else {
    const toTokenResult = await resolveTokensMultiProvider(intent.toToken, toChainId);
    if (toTokenResult.needsSelection) {
      const compatibleTokens = toTokenResult.tokens.map((token, index) => ({
        id: index + 1,
        chainId: token.chainId,
        address: token.address as string,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        logoURI: token.logoURI,
        verified: token.verified || false,
      }));
      throw new DeFiTokenSelectionError(
        toTokenResult.message || `Multiple '${intent.toToken}' tokens found. Please select one:`,
        compatibleTokens,
        "to"
      );
    }

    if (toTokenResult.tokens.length === 0) {
      throw new DeFiNormalizationError(
        `Token '${intent.toToken}' not found on chain ${toChainId}`,
        "TOKEN_NOT_FOUND"
      );
    }

    const resolvedToToken = toTokenResult.tokens[0];
    const verifiedToDecimals = await verifyDeFiTokenDecimals(resolvedToToken, toChainId);
    toToken = {
      ...resolvedToToken,
      decimals: verifiedToDecimals,
    };
  }

  // Parse amount (handle USD or token amount)
  let bridgeSwapAmount: string;
  
  if (isUSDBasedIntent(intent as any) && intent.amountUSD) {
    console.log(`💵 [DeFi] Converting USD amount for bridge-swap: ${intent.amountUSD}`);
    
    try {
      const usdAmount = parseIntentUSDAmount(intent.amountUSD);
      const tokenAmount = await convertUSDToToken(usdAmount, fromToken.symbol, fromChainId);
      bridgeSwapAmount = tokenAmount;
      
      console.log(`✅ [DeFi] Converted ${intent.amountUSD} → ${tokenAmount} ${fromToken.symbol}`);
    } catch (error) {
      throw new DeFiNormalizationError(
        `Failed to convert USD amount for bridge-swap: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "USD_CONVERSION_FAILED"
      );
    }
  } else if (intent.amount) {
    bridgeSwapAmount = intent.amount;
  } else {
    throw new DeFiNormalizationError(
      "Amount or amountUSD is required for bridge-swap",
      "AMOUNT_REQUIRED"
    );
  }

  const fromAmount = parseUnits(bridgeSwapAmount, fromToken.decimals);

  // Resolve recipient
  let recipient: `0x${string}` | undefined;

  if (intent.recipient) {
    if (isEnsName(intent.recipient)) {
      try {
        const resolved = await resolveAddressOrEns(intent.recipient);
        recipient = getAddress(resolved);
        console.log(`✅ [DeFi] Resolved bridge-swap recipient ENS '${intent.recipient}' to ${recipient}`);
      } catch (error) {
        throw new DeFiNormalizationError(
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
    throw new DeFiNormalizationError(
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
