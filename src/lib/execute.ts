// lib/execute.ts - Smart Account execution engine using Privy

import { formatEther } from "viem";
import type { NormalizedNativeTransfer, NormalizedIntent } from "./normalize";
import type { AccountMode } from "@/cli/state/types";
import { getTxUrl, formatSuccessMessage } from "./explorer";

export class ExecutionError extends Error {
  constructor(
    message: string,
    public code: string,
    public txHash?: string,
  ) {
    super(message);
    this.name = "ExecutionError";
  }
}

export interface ExecutionResult {
  success: true;
  txHash: string;
  message: string;
  explorerUrl: string;
}

/**
 * Execute native ETH transfer using either EOA or Smart Account
 */
export async function executeNativeTransfer(
  norm: NormalizedNativeTransfer,
  accountMode: AccountMode = "EOA",
  clients: {
    smartWalletClient?: any; // Privy Smart Account client
    eoaSendTransaction?: (
      transaction: { to: `0x${string}`; value: bigint },
      options?: { address?: string }
    ) => Promise<{ hash: `0x${string}` }>;
    selectedWallet?: any; // Privy ConnectedWallet
  }
): Promise<ExecutionResult> {
  // Validate required clients based on account mode
  if (accountMode === "SMART_ACCOUNT") {
    if (!clients.smartWalletClient) {
      throw new ExecutionError(
        "Smart Account client not available. Please ensure you're logged in.",
        "CLIENT_NOT_AVAILABLE"
      );
    }
  } else {
    // EOA mode
    if (!clients.eoaSendTransaction || !clients.selectedWallet) {
      throw new ExecutionError(
        "EOA transaction capability not available. Please ensure you're logged in.",
        "EOA_CLIENT_NOT_AVAILABLE"
      );
    }
  }

  try {
    console.log("🔄 Executing native transfer...", {
      to: norm.to,
      amount: formatEther(norm.amountWei),
      chainId: norm.chainId,
      accountMode,
    });

    let txHash: string;

    if (accountMode === "SMART_ACCOUNT") {
      // Execute via Privy Smart Account
      txHash = await clients.smartWalletClient!.sendTransaction({
        to: norm.to,
        value: norm.amountWei,
      });
    } else {
      // Execute via EOA
      const result = await clients.eoaSendTransaction!(
        {
          to: norm.to,
          value: norm.amountWei,
        },
        {
          address: clients.selectedWallet!.address,
        }
      );
      txHash = result.hash;
    }

    if (!txHash || typeof txHash !== "string") {
      throw new ExecutionError(
        "Transaction failed: No transaction hash returned",
        "NO_TX_HASH"
      );
    }

    console.log(`✅ Transaction submitted successfully via ${accountMode}:`, txHash);

    // Generate success message and explorer URL
    const amount = formatEther(norm.amountWei);
    const message = formatSuccessMessage(amount, norm.chainId, txHash);
    const explorerUrl = getTxUrl(norm.chainId, txHash);

    return {
      success: true,
      txHash,
      message,
      explorerUrl,
    };

  } catch (error: any) {
    console.error(`❌ ${accountMode} execution failed:`, error);

    // Handle specific Privy Smart Account errors
    if (error?.message?.includes("insufficient funds")) {
      throw new ExecutionError(
        "Insufficient balance for transaction + gas fees",
        "INSUFFICIENT_FUNDS",
      );
    }

    if (error?.message?.includes("user rejected")) {
      throw new ExecutionError(
        "Transaction was rejected by user",
        "USER_REJECTED",
      );
    }

    if (error?.message?.includes("gas")) {
      throw new ExecutionError(
        "Transaction failed due to gas estimation error",
        "GAS_ERROR",
      );
    }

    if (error?.message?.includes("nonce")) {
      throw new ExecutionError(
        "Transaction failed due to nonce error. Please try again.",
        "NONCE_ERROR",
      );
    }

    // Bundler/network errors
    if (error?.message?.includes("bundler")) {
      throw new ExecutionError(
        "Transaction failed: Bundler error. Please try again.",
        "BUNDLER_ERROR",
      );
    }

    if (error?.message?.includes("network")) {
      throw new ExecutionError(
        "Transaction failed: Network error. Please try again.",
        "NETWORK_ERROR",
      );
    }

    // Generic execution error
    throw new ExecutionError(
      `Transaction execution failed: ${error?.message || "Unknown error"}`,
      "EXECUTION_FAILED",
    );
  }
}

/**
 * Execute ERC-20 token transfer using either EOA or Smart Account
 * Note: This is prepared for future implementation but not active in MVP
 */
export async function executeERC20Transfer(
  norm: any, // NormalizedERC20Transfer when implemented
  accountMode: AccountMode = "EOA",
  clients: {
    smartWalletClient?: any;
    eoaSendTransaction?: (
      transaction: { to: `0x${string}`; value: bigint },
      options?: { address?: string }
    ) => Promise<{ hash: `0x${string}` }>;
    selectedWallet?: any;
  }
): Promise<ExecutionResult> {
  throw new ExecutionError(
    "ERC-20 token transfers not yet supported in MVP",
    "ERC20_NOT_IMPLEMENTED"
  );
}

/**
 * Main execution router - handles all intent types
 */
export async function executeIntent(
  norm: NormalizedIntent,
  accountMode: AccountMode = "EOA",
  clients: {
    smartWalletClient?: any;
    eoaSendTransaction?: (
      transaction: { to: `0x${string}`; value: bigint },
      options?: { address?: string }
    ) => Promise<{ hash: `0x${string}` }>;
    selectedWallet?: any;
  }
): Promise<ExecutionResult> {
  if (norm.kind === "native-transfer") {
    return executeNativeTransfer(norm, accountMode, clients);
  } else if (norm.kind === "erc20-transfer") {
    return executeERC20Transfer(norm, accountMode, clients);
  } else {
    throw new ExecutionError(
      `Unsupported transfer type: ${(norm as any).kind}`,
      "UNSUPPORTED_TRANSFER_TYPE"
    );
  }
}

/**
 * Get Smart Account address from user's linked accounts
 * Note: Privy Smart Wallet address is available through user.linkedAccounts, not client.getAddress()
 */
export function getSmartAccountAddress(smartAccountAddress: `0x${string}` | undefined): `0x${string}` {
  if (!smartAccountAddress) {
    throw new ExecutionError(
      "Smart Account address not available. Please ensure you're logged in and have a Smart Wallet.",
      "ADDRESS_NOT_AVAILABLE"
    );
  }

  if (!smartAccountAddress.startsWith("0x") || smartAccountAddress.length !== 42) {
    throw new ExecutionError(
      "Invalid Smart Account address format",
      "INVALID_ADDRESS"
    );
  }

  return smartAccountAddress;
}

/**
 * Check if Smart Account is deployed
 */
export function isSmartAccountDeployed(
  smartAccountAddress: `0x${string}` | undefined,
): boolean {
  try {
    // If we have a Smart Account address, Privy has created it
    getSmartAccountAddress(smartAccountAddress);
    return true; // Privy handles deployment automatically
  } catch {
    return false;
  }
}

/**
 * Format execution error for user display
 */
export function formatExecutionError(error: ExecutionError): string {
  const errorMessages: Record<string, string> = {
    CLIENT_NOT_AVAILABLE: "⚠️ Smart Account not ready. Please refresh and try again.",
    INSUFFICIENT_FUNDS: "💰 Insufficient balance for transaction + gas fees.",
    USER_REJECTED: "❌ Transaction was canceled by user.",
    GAS_ERROR: "⛽ Gas estimation failed. Try a smaller amount.",
    NONCE_ERROR: "🔄 Transaction ordering error. Please try again.",
    BUNDLER_ERROR: "🌐 Network congestion. Please try again in a moment.",
    NETWORK_ERROR: "📡 Network connection error. Check your connection.",
    NO_TX_HASH: "❌ Transaction failed to submit properly.",
    EXECUTION_FAILED: "❌ Transaction execution failed.",
  };

  return errorMessages[error.code] || `❌ ${error.message}`;
}