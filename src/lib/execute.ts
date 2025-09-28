// lib/execute.ts - Smart Account execution engine using Privy

import { formatEther } from "viem";
import type { NormalizedNativeTransfer, NormalizedERC20Transfer, NormalizedIntent } from "./normalize";
import type { AccountMode } from "@/cli/state/types";
import { getTxUrl, formatSuccessMessage } from "./explorer";
import { getChainConfig } from "./chains/registry";

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
  norm: NormalizedERC20Transfer,
  accountMode: AccountMode = "EOA",
  clients: {
    smartWalletClient?: any;
    eoaSendTransaction?: (
      transaction: { to: `0x${string}`; value: bigint; data?: `0x${string}` },
      options?: { address?: string }
    ) => Promise<{ hash: `0x${string}` }>;
    selectedWallet?: any;
  }
): Promise<ExecutionResult> {
  // Get chain configuration for explorer URLs
  const chainConfig = getChainConfig(norm.chainId);
  if (!chainConfig) {
    throw new ExecutionError(
      `Chain configuration not found for chain ${norm.chainId}`,
      "CHAIN_CONFIG_MISSING"
    );
  }

  // Encode the ERC-20 transfer function call
  const { encodeFunctionData } = await import("viem");
  const data = encodeFunctionData({
    abi: [
      {
        name: 'transfer',
        type: 'function',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable'
      }
    ],
    functionName: 'transfer',
    args: [norm.to, norm.amountWei]
  });

  const transaction = {
    to: norm.token.address,
    value: 0n, // ERC-20 transfers don't send native currency
    data
  };

  try {
    let txHash: `0x${string}`;

    if (accountMode === "SMART_ACCOUNT" && clients.smartWalletClient) {
      // Execute via Smart Account
      console.log("🔄 Executing ERC-20 transfer via Smart Account...");

      const userOpHash = await clients.smartWalletClient.sendUserOperation({
        calls: [transaction]
      });

      // Wait for the user operation to be processed
      const receipt = await clients.smartWalletClient.waitForUserOperationReceipt({
        hash: userOpHash
      });

      txHash = receipt.receipt.transactionHash as `0x${string}`;
      console.log("✅ Smart Account ERC-20 transfer executed:", txHash);

    } else if (accountMode === "EOA" && clients.eoaSendTransaction) {
      // Execute via EOA
      console.log("🔄 Executing ERC-20 transfer via EOA...");

      const result = await clients.eoaSendTransaction(transaction, {
        address: clients.selectedWallet?.address
      });

      txHash = result.hash;
      console.log("✅ EOA ERC-20 transfer executed:", txHash);

    } else {
      throw new ExecutionError(
        `Invalid execution mode: ${accountMode} or missing client`,
        "INVALID_EXECUTION_MODE"
      );
    }

    // Format amounts for display
    const { formatUnits } = await import("viem");
    const amountFormatted = formatUnits(norm.amountWei, norm.token.decimals);

    // Build explorer URL
    const explorerUrl = `${chainConfig.explorerUrl}/tx/${txHash}`;

    return {
      success: true,
      txHash,
      explorerUrl,
      message: `✅ Sent ${amountFormatted} ${norm.token.symbol} on ${chainConfig.name} — hash ${txHash}`,
    };

  } catch (error: any) {
    console.error("ERC-20 execution error:", error);

    // Handle specific error types
    if (error.message?.includes("insufficient funds") || error.message?.includes("insufficient balance")) {
      throw new ExecutionError(
        "Insufficient token balance for transfer",
        "INSUFFICIENT_FUNDS"
      );
    }

    if (error.message?.includes("user rejected") || error.message?.includes("User rejected")) {
      throw new ExecutionError(
        "Transaction was cancelled by user",
        "USER_REJECTED"
      );
    }

    if (error.message?.includes("gas")) {
      throw new ExecutionError(
        "Transaction failed due to gas issues",
        "GAS_ERROR"
      );
    }

    throw new ExecutionError(
      error.message || "ERC-20 transfer failed unexpectedly",
      error.code || "EXECUTION_FAILED"
    );
  }
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