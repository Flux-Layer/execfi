// lib/defi/normalize.ts - DeFi-specific normalization

import { parseUnits, isAddress, getAddress } from "viem";
import type { SwapIntent, BridgeIntent, BridgeSwapIntent, NormalizedSwap, NormalizedBridge, NormalizedBridgeSwap, NormalizedDeFi } from "./types";
import { DeFiNormalizationError, DeFiTokenSelectionError } from "./errors";
import { resolveChain } from "@/lib/chains/registry";
import { resolveTokensMultiProvider } from "@/lib/normalize";
import { resolveAddressOrEns, isEnsName } from "@/lib/ens";

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
    fromToken = {
      address: selectedFromToken.address,
      symbol: selectedFromToken.symbol,
      decimals: selectedFromToken.decimals || 18,
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

    fromToken = fromTokenResult.tokens[0];
  }

  // Resolve toToken
  if (selectedToToken) {
    toToken = {
      address: selectedToToken.address,
      symbol: selectedToToken.symbol,
      decimals: selectedToToken.decimals || 18,
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
    token = {
      address: selectedToken.address,
      symbol: selectedToken.symbol,
      decimals: selectedToken.decimals || 18,
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

    token = tokenResult.tokens[0];
  }

  // Parse amount
  const amount = parseUnits(intent.amount, token.decimals);

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
    fromToken = {
      address: selectedFromToken.address,
      symbol: selectedFromToken.symbol,
      decimals: selectedFromToken.decimals || 18,
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

    fromToken = fromTokenResult.tokens[0];
  }

  // Resolve toToken (on destination chain)
  if (selectedToToken) {
    toToken = {
      address: selectedToToken.address,
      symbol: selectedToToken.symbol,
      decimals: selectedToToken.decimals || 18,
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

    toToken = toTokenResult.tokens[0];
  }

  // Parse amount
  const fromAmount = parseUnits(intent.amount, fromToken.decimals);

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
