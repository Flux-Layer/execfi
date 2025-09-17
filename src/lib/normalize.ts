// lib/normalize.ts - Intent normalization layer

import { parseEther, parseUnits, isAddress, getAddress } from "viem";
import type { IntentSuccess, TransferIntent } from "./ai";
import { resolveTokenSymbol, type Token } from "./tokens";

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
 * Chain name/ID mapping registry
 */
const CHAIN_REGISTRY: Record<string, number> = {
  "base": 8453,
  "baseSepolia": 84532,
  "base-sepolia": 84532,
  "baseMainnet": 8453,
  "base-mainnet": 8453,
  "ethereum": 1,
  "mainnet": 1,
  "polygon": 137,
  "arbitrum": 42161,
  "optimism": 10,
  "avalanche": 43114,
};

/**
 * Supported chains for MVP
 */
const SUPPORTED_CHAINS = new Set([8453, 84532]); // Base mainnet + sepolia only

/**
 * Resolve chain name to chainId
 */
function resolveChain(chain: string | number): number {
  if (typeof chain === "number") {
    return chain;
  }

  const chainId = CHAIN_REGISTRY[chain.toLowerCase()];
  if (!chainId) {
    throw new NormalizationError(
      `Unsupported chain: ${chain}. Supported: base, baseSepolia`,
      "CHAIN_UNSUPPORTED"
    );
  }

  return chainId;
}

/**
 * Normalize transfer intent to internal format
 */
export function normalizeTransferIntent(intent: TransferIntent): NormalizedIntent {
  // Resolve chain
  const chainId = resolveChain(intent.chain);

  // Validate chain is supported in MVP
  if (!SUPPORTED_CHAINS.has(chainId)) {
    throw new NormalizationError(
      `Chain ${chainId} not supported in MVP. Only Base (8453) and Base Sepolia (84532) are supported.`,
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
    // Native ETH transfer
    if (intent.token.symbol !== "ETH") {
      throw new NormalizationError(
        "Only ETH is supported for native transfers",
        "NATIVE_TOKEN_UNSUPPORTED"
      );
    }

    // Parse amount to wei
    let amountWei: bigint;
    try {
      const amountNumber = parseFloat(intent.amount);
      if (isNaN(amountNumber) || amountNumber <= 0) {
        throw new Error("Invalid amount");
      }
      amountWei = parseEther(intent.amount);
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
    const tokenResolution = resolveTokenSymbol(intent.token.symbol, chainId);

    if (tokenResolution.needsSelection) {
      // Multiple tokens found - throw TokenSelectionError
      throw new TokenSelectionError(
        tokenResolution.message,
        "TOKEN_SELECTION_REQUIRED",
        tokenResolution.tokens
      );
    }

    const token = tokenResolution.token;

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