// lib/execute.ts - Smart Account execution engine using Privy + LI.FI

import { formatEther, formatUnits, encodeFunctionData } from "viem";
import type {
  NormalizedNativeTransfer,
  NormalizedERC20Transfer,
  NormalizedSwap,
  NormalizedBridge,
  NormalizedBridgeSwap,
  NormalizedIntent,
} from "./normalize";
import type { AccountMode } from "@/cli/state/types";
import { getTxUrl, formatSuccessMessage } from "./explorer";
import { getChainConfig } from "./chains/registry";
import { FEE_ENTRYPOINT_ADDRESSES, FEE_ENTRYPOINT_ABI } from "./contracts/entrypoint";

// Feature flag for LI.FI execution path
const ENABLE_LIFI_EXECUTION =
  process.env.NEXT_PUBLIC_ENABLE_LIFI_EXECUTION === "true";
const ENABLE_ENTRYPOINT =
  process.env.NEXT_PUBLIC_ENABLE_ENTRYPOINT === "true";

// Types for LI.FI API integration
interface LifiTransactionData {
  to: string;
  value: string;
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
  chainId: number;
}

interface LifiPrepareResponse {
  success: boolean;
  transactionData?: LifiTransactionData;
  route?: any;
  quote?: {
    fromAmount: string;
    toAmount: string;
    toAmountMin: string;
    gasEstimate: string;
    executionTime: number;
    priceImpact?: number;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  requestId: string;
}

/**
 * Call LI.FI preparation API to get transaction data (Step 7.2 replacement)
 */
async function prepareLifiTransaction(
  norm: NormalizedIntent,
  fromAddress: string,
): Promise<LifiTransactionData> {
  // Get chainId based on intent type
  const chainId = "chainId" in norm ? norm.chainId : norm.fromChainId;
  const chainConfig = getChainConfig(chainId);
  if (!chainConfig) {
    throw new ExecutionError(
      `Chain configuration not found for chain ${chainId}`,
      "CHAIN_CONFIG_MISSING",
    );
  }

  // Build preparation request based on intent type
  let prepareRequest: any;

  if (norm.kind === "native-transfer") {
    // Native ETH transfer via LI.FI (same-chain routing)
    prepareRequest = {
      fromChain: norm.chainId,
      toChain: norm.chainId, // Same chain for native transfers
      fromToken: "0x0000000000000000000000000000000000000000", // Native token address
      toToken: "0x0000000000000000000000000000000000000000", // Native token address
      amount: norm.amountWei.toString(),
      fromAddress,
      toAddress: norm.to,
      slippage: 0.005, // 0.5% slippage for native transfers
      routePreference: "recommended",
      validateFreshness: true,
    };
  } else if (norm.kind === "erc20-transfer") {
    // ERC-20 token transfer via LI.FI
    prepareRequest = {
      fromChain: norm.chainId,
      toChain: norm.chainId, // Same chain for ERC-20 transfers
      fromToken: norm.token.address,
      toToken: norm.token.address, // Same token for transfers
      amount: norm.amountWei.toString(),
      fromAddress,
      toAddress: norm.to,
      slippage: 0.005,
      routePreference: "recommended",
      validateFreshness: true,
    };
  } else {
    throw new ExecutionError(
      `Unsupported transfer type for LI.FI: ${(norm as any).kind}`,
      "UNSUPPORTED_TRANSFER_TYPE",
    );
  }

  try {
    console.log(`🔄 Calling LI.FI preparation API for ${norm.kind}...`);

    const response = await fetch("/api/lifi/prepare", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(prepareRequest),
      cache: "no-store", // Always get fresh quotes
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LI.FI API error: ${response.status} ${errorText}`);
    }

    const result: LifiPrepareResponse = await response.json();

    if (!result.success || !result.transactionData) {
      const errorMessage =
        result.error?.message || "Unknown LI.FI preparation error";
      const errorCode = result.error?.code || "LIFI_PREPARATION_FAILED";

      console.error(
        `❌ LI.FI preparation failed [${result.requestId}]:`,
        result.error,
      );

      throw new ExecutionError(
        `LI.FI preparation failed: ${errorMessage}`,
        errorCode,
      );
    }

    console.log(`✅ LI.FI preparation successful [${result.requestId}]`);

    // Log route information for transparency
    if (result.quote) {
      const fromAmount = formatEther(BigInt(result.quote.fromAmount));
      const toAmount = formatEther(BigInt(result.quote.toAmount));
      console.log(
        `📊 Route: ${fromAmount} → ${toAmount} (${result.quote.executionTime}s)`,
      );
    }

    return result.transactionData;
  } catch (error) {
    console.error("❌ LI.FI preparation request failed:", error);

    if (error instanceof ExecutionError) {
      throw error;
    }

    throw new ExecutionError(
      `Failed to prepare transaction via LI.FI: ${error instanceof Error ? error.message : "Unknown error"}`,
      "LIFI_PREPARATION_REQUEST_FAILED",
    );
  }
}

/**
 * Prepare transaction data directly (current Step 7.2 implementation)
 */
async function prepareDirectTransaction(norm: NormalizedIntent): Promise<any> {
  if (norm.kind === "native-transfer") {
    // Direct native transfer
    return {
      to: norm.to,
      value: norm.amountWei,
    };
  } else if (norm.kind === "erc20-transfer") {
    // Direct ERC-20 transfer with encoded function data
    const { encodeFunctionData } = await import("viem");
    const data = encodeFunctionData({
      abi: [
        {
          name: "transfer",
          type: "function",
          inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
          stateMutability: "nonpayable",
        },
      ],
      functionName: "transfer",
      args: [norm.to, norm.amountWei],
    });

    return {
      to: norm.token.address,
      value: 0n,
      data,
    };
  } else {
    throw new ExecutionError(
      `Unsupported transfer type: ${(norm as any).kind}`,
      "UNSUPPORTED_TRANSFER_TYPE",
    );
  }
}

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
 * Execute native ETH transfer using either EOA or Smart Account (Enhanced with LI.FI)
 */
export async function executeNativeTransfer(
  norm: NormalizedNativeTransfer,
  accountMode: AccountMode = "EOA",
  clients: {
    smartWalletClient?: any; // Privy Smart Account client
    eoaSendTransaction?: (
      transaction: { to: `0x${string}`; value: bigint; data?: `0x${string}` },
      options?: { address?: string },
    ) => Promise<{ hash: `0x${string}` }>;
    selectedWallet?: any; // Privy ConnectedWallet
  },
): Promise<ExecutionResult> {
  // Step 7.1: Client Validation (Enhanced with LI.FI connectivity check)
  if (accountMode === "SMART_ACCOUNT") {
    if (!clients.smartWalletClient) {
      throw new ExecutionError(
        "Smart Account client not available. Please ensure you're logged in.",
        "CLIENT_NOT_AVAILABLE",
      );
    }
  } else {
    // EOA mode
    if (!clients.eoaSendTransaction || !clients.selectedWallet) {
      throw new ExecutionError(
        "EOA transaction capability not available. Please ensure you're logged in.",
        "EOA_CLIENT_NOT_AVAILABLE",
      );
    }
  }

  try {
    console.log("🔄 Executing native transfer...", {
      to: norm.to,
      amount: formatEther(norm.amountWei),
      chainId: norm.chainId,
      accountMode,
      lifiEnabled: ENABLE_LIFI_EXECUTION,
    });

    // Step 7.2: Transaction Preparation (LI.FI vs Direct)
    let transactionData: any;

    if (ENABLE_LIFI_EXECUTION) {
      // New: LI.FI preparation path
      const fromAddress =
        accountMode === "SMART_ACCOUNT"
          ? clients.smartWalletClient!.getAddress()
          : clients.selectedWallet!.address;

      const lifiTxData = await prepareLifiTransaction(norm, fromAddress);

      // Convert LI.FI response to format expected by Privy clients
      transactionData = {
        to: lifiTxData.to as `0x${string}`,
        value: BigInt(lifiTxData.value),
        data: lifiTxData.data as `0x${string}` | undefined,
      };
    } else {
      // Current: Direct preparation path
      transactionData = await prepareDirectTransaction(norm);

      // If EntryPoint is enabled and deployed for this chain, wrap native transfer via EntryPoint
      const entrypoint = FEE_ENTRYPOINT_ADDRESSES[norm.chainId];
      if (ENABLE_ENTRYPOINT && entrypoint) {
        transactionData = {
          to: entrypoint as `0x${string}`,
          value: norm.amountWei,
          data: encodeFunctionData({
            abi: FEE_ENTRYPOINT_ABI,
            functionName: "transferETH",
            args: [norm.to],
          }),
        };
      }
    }

    // Step 7.3: Transaction Execution (Unchanged - preserves existing Privy signing)
    let txHash: string;

    if (accountMode === "SMART_ACCOUNT") {
      // Execute via Privy Smart Account
      txHash =
        await clients.smartWalletClient!.sendTransaction(transactionData);
    } else {
      // Execute via EOA
      const result = await clients.eoaSendTransaction!(transactionData, {
        address: clients.selectedWallet!.address,
      });
      txHash = result.hash;
    }

    if (!txHash || typeof txHash !== "string") {
      throw new ExecutionError(
        "Transaction failed: No transaction hash returned",
        "NO_TX_HASH",
      );
    }

    console.log(
      `✅ Transaction submitted successfully via ${accountMode}:`,
      txHash,
    );

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
 * Execute ERC-20 token transfer using either EOA or Smart Account (Enhanced with LI.FI)
 * Note: This is prepared for future implementation but not active in MVP
 */
export async function executeERC20Transfer(
  norm: NormalizedERC20Transfer,
  accountMode: AccountMode = "EOA",
  clients: {
    smartWalletClient?: any;
    eoaSendTransaction?: (
      transaction: { to: `0x${string}`; value: bigint; data?: `0x${string}` },
      options?: { address?: string },
    ) => Promise<{ hash: `0x${string}` }>;
    selectedWallet?: any;
  },
): Promise<ExecutionResult> {
  // Get chain configuration for explorer URLs
  const chainConfig = getChainConfig(norm.chainId);
  if (!chainConfig) {
    throw new ExecutionError(
      `Chain configuration not found for chain ${norm.chainId}`,
      "CHAIN_CONFIG_MISSING",
    );
  }

  // Step 7.2: Transaction Preparation (LI.FI vs Direct)
  let transaction: any;

  if (ENABLE_LIFI_EXECUTION) {
    // New: LI.FI preparation path for ERC-20 transfers
    const fromAddress =
      accountMode === "SMART_ACCOUNT"
        ? clients.smartWalletClient!.getAddress()
        : clients.selectedWallet!.address;

    const lifiTxData = await prepareLifiTransaction(norm, fromAddress);

    transaction = {
      to: lifiTxData.to as `0x${string}`,
      value: BigInt(lifiTxData.value),
      data: lifiTxData.data as `0x${string}`,
    };
  } else {
    // Current: Direct ERC-20 preparation path
    const data = encodeFunctionData({
      abi: [
        {
          name: "transfer",
          type: "function",
          inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
          stateMutability: "nonpayable",
        },
      ],
      functionName: "transfer",
      args: [norm.to, norm.amountWei],
    });

    transaction = {
      to: norm.token.address,
      value: 0n, // ERC-20 transfers don't send native currency
      data,
    };

    // If EntryPoint is enabled and deployed for this chain, route via EntryPoint
    const entrypoint = FEE_ENTRYPOINT_ADDRESSES[norm.chainId];
    if (ENABLE_ENTRYPOINT && entrypoint) {
      transaction = {
        to: entrypoint as `0x${string}`,
        value: 0n,
        data: encodeFunctionData({
          abi: FEE_ENTRYPOINT_ABI,
          functionName: "transferERC20",
          args: [norm.token.address, norm.to, norm.amountWei],
        }),
      };
    }
  }

  try {
    let txHash: `0x${string}`;

    if (accountMode === "SMART_ACCOUNT" && clients.smartWalletClient) {
      // Execute via Smart Account
      console.log("🔄 Executing ERC-20 transfer via Smart Account...");

      const userOpHash = await clients.smartWalletClient.sendUserOperation({
        calls: [transaction],
      });

      // Wait for the user operation to be processed
      const receipt =
        await clients.smartWalletClient.waitForUserOperationReceipt({
          hash: userOpHash,
        });

      txHash = receipt.receipt.transactionHash as `0x${string}`;
      console.log("✅ Smart Account ERC-20 transfer executed:", txHash);
    } else if (accountMode === "EOA" && clients.eoaSendTransaction) {
      // Execute via EOA
      console.log("🔄 Executing ERC-20 transfer via EOA...");

      const result = await clients.eoaSendTransaction(transaction, {
        address: clients.selectedWallet?.address,
      });

      txHash = result.hash;
      console.log("✅ EOA ERC-20 transfer executed:", txHash);
    } else {
      throw new ExecutionError(
        `Invalid execution mode: ${accountMode} or missing client`,
        "INVALID_EXECUTION_MODE",
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
    if (
      error.message?.includes("insufficient funds") ||
      error.message?.includes("insufficient balance")
    ) {
      throw new ExecutionError(
        "Insufficient token balance for transfer",
        "INSUFFICIENT_FUNDS",
      );
    }

    if (
      error.message?.includes("user rejected") ||
      error.message?.includes("User rejected")
    ) {
      throw new ExecutionError(
        "Transaction was cancelled by user",
        "USER_REJECTED",
      );
    }

    if (error.message?.includes("gas")) {
      throw new ExecutionError(
        "Transaction failed due to gas issues",
        "GAS_ERROR",
      );
    }

    throw new ExecutionError(
      error.message || "ERC-20 transfer failed unexpectedly",
      error.code || "EXECUTION_FAILED",
    );
  }
}

/**
 * Execute swap operation using LI.FI
 */
export async function executeSwap(
  norm: NormalizedSwap,
  accountMode: AccountMode = "EOA",
  clients: {
    smartWalletClient?: any;
    eoaSendTransaction?: (
      transaction: { to: `0x${string}`; value: bigint; data?: `0x${string}` },
      options?: { address?: string },
    ) => Promise<{ hash: `0x${string}` }>;
    selectedWallet?: any;
  },
  route?: any
): Promise<ExecutionResult> {
  if (!route) {
    throw new ExecutionError(
      "No route data available for swap execution",
      "ROUTE_MISSING"
    );
  }

  try {
    console.log("🔄 Executing swap via LI.FI...", {
      fromToken: norm.fromToken.symbol,
      toToken: norm.toToken.symbol,
      chain: norm.fromChainId,
    });

    // Extract transaction data from route (already prepared during planning phase)
    const firstStep = route.steps?.[0];
    if (!firstStep?.transactionRequest) {
      throw new ExecutionError(
        "Route missing transaction request data",
        "INVALID_ROUTE_DATA"
      );
    }

    const txRequest = firstStep.transactionRequest;
    console.log("✅ Extracted transaction data from route:", {
      to: txRequest.to,
      value: txRequest.value,
      hasData: !!txRequest.data,
    });

    // Execute transaction
    let txHash: string;

    if (accountMode === "SMART_ACCOUNT") {
      txHash = await clients.smartWalletClient!.sendTransaction({
        to: txRequest.to as `0x${string}`,
        value: BigInt(txRequest.value || 0),
        data: txRequest.data as `0x${string}`,
      });
    } else {
      try {
        const txResult = await clients.eoaSendTransaction!({
          to: txRequest.to as `0x${string}`,
          value: BigInt(txRequest.value || 0),
          data: txRequest.data as `0x${string}`,
        }, {
          address: clients.selectedWallet!.address,
        });
        txHash = txResult.hash;
      } catch (sendError: any) {
        console.error("❌ EOA sendTransaction error:", sendError);
        
        // Handle specific error types from viem/privy
        if (sendError.name === "EstimateGasExecutionError" || sendError.message?.includes("execution reverted")) {
          throw new ExecutionError(
            `Transaction validation failed: ${sendError.details || sendError.message}. This may be due to insufficient balance, slippage, or liquidity issues.`,
            "TRANSACTION_REVERTED"
          );
        }
        
        throw sendError; // Re-throw other errors to be caught by outer catch
      }
    }

    const chainConfig = getChainConfig(norm.fromChainId);
    const explorerUrl = getTxUrl(norm.fromChainId, txHash);

    return {
      success: true,
      txHash,
      message: `✅ Swap initiated on ${chainConfig?.name}`,
      explorerUrl,
    };
  } catch (error: any) {
    console.error("❌ Swap execution error:", error);
    
    // Handle specific error types
    if (error instanceof ExecutionError) {
      throw error; // Re-throw ExecutionError as-is
    }
    
    // Handle user rejection
    if (error.message?.includes("user rejected") || error.message?.includes("User rejected") || error.code === "ACTION_REJECTED") {
      throw new ExecutionError(
        "Transaction was cancelled by user",
        "USER_REJECTED"
      );
    }
    
    // Handle insufficient funds
    if (error.message?.includes("insufficient funds") || error.message?.includes("insufficient balance")) {
      throw new ExecutionError(
        "Insufficient balance to complete swap (including gas fees)",
        "INSUFFICIENT_FUNDS"
      );
    }
    
    // Generic error
    throw new ExecutionError(
      `Swap execution failed: ${error.message || "Unknown error"}`,
      "SWAP_EXECUTION_FAILED"
    );
  }
}

/**
 * Execute bridge operation using LI.FI
 */
export async function executeBridge(
  norm: NormalizedBridge,
  accountMode: AccountMode = "EOA",
  clients: {
    smartWalletClient?: any;
    eoaSendTransaction?: (
      transaction: { to: `0x${string}`; value: bigint; data?: `0x${string}` },
      options?: { address?: string },
    ) => Promise<{ hash: `0x${string}` }>;
    selectedWallet?: any;
  },
  route?: any
): Promise<ExecutionResult> {
  if (!route) {
    throw new ExecutionError(
      "No route data available for bridge execution",
      "ROUTE_MISSING"
    );
  }

  try {
    console.log("🔄 Executing bridge via LI.FI...", {
      token: norm.token.symbol,
      fromChain: norm.fromChainId,
      toChain: norm.toChainId,
    });

    // Extract transaction data from route (already prepared during planning phase)
    const firstStep = route.steps?.[0];
    if (!firstStep?.transactionRequest) {
      throw new ExecutionError(
        "Route missing transaction request data",
        "INVALID_ROUTE_DATA"
      );
    }

    const txRequest = firstStep.transactionRequest;
    console.log("✅ Extracted transaction data from route:", {
      to: txRequest.to,
      value: txRequest.value,
      hasData: !!txRequest.data,
    });

    // Execute transaction
    let txHash: string;

    if (accountMode === "SMART_ACCOUNT") {
      txHash = await clients.smartWalletClient!.sendTransaction({
        to: txRequest.to as `0x${string}`,
        value: BigInt(txRequest.value || 0),
        data: txRequest.data as `0x${string}`,
      });
    } else {
      try {
        const txResult = await clients.eoaSendTransaction!({
          to: txRequest.to as `0x${string}`,
          value: BigInt(txRequest.value || 0),
          data: txRequest.data as `0x${string}`,
        }, {
          address: clients.selectedWallet!.address,
        });
        txHash = txResult.hash;
      } catch (sendError: any) {
        console.error("❌ EOA sendTransaction error:", sendError);
        
        if (sendError.name === "EstimateGasExecutionError" || sendError.message?.includes("execution reverted")) {
          throw new ExecutionError(
            `Transaction validation failed: ${sendError.details || sendError.message}. This may be due to insufficient balance, slippage, or liquidity issues.`,
            "TRANSACTION_REVERTED"
          );
        }
        
        throw sendError;
      }
    }

    const fromChainConfig = getChainConfig(norm.fromChainId);
    const toChainConfig = getChainConfig(norm.toChainId);
    const explorerUrl = getTxUrl(norm.fromChainId, txHash);

    return {
      success: true,
      txHash,
      message: `✅ Bridge initiated: ${fromChainConfig?.name} → ${toChainConfig?.name}`,
      explorerUrl,
    };
  } catch (error: any) {
    console.error("❌ Bridge execution error:", error);
    
    if (error instanceof ExecutionError) {
      throw error;
    }
    
    if (error.message?.includes("user rejected") || error.message?.includes("User rejected") || error.code === "ACTION_REJECTED") {
      throw new ExecutionError(
        "Transaction was cancelled by user",
        "USER_REJECTED"
      );
    }
    
    if (error.message?.includes("insufficient funds") || error.message?.includes("insufficient balance")) {
      throw new ExecutionError(
        "Insufficient balance to complete bridge (including gas fees)",
        "INSUFFICIENT_FUNDS"
      );
    }
    
    throw new ExecutionError(
      `Bridge execution failed: ${error.message || "Unknown error"}`,
      "BRIDGE_EXECUTION_FAILED"
    );
  }
}

/**
 * Execute bridge-swap operation using LI.FI
 */
export async function executeBridgeSwap(
  norm: NormalizedBridgeSwap,
  accountMode: AccountMode = "EOA",
  clients: {
    smartWalletClient?: any;
    eoaSendTransaction?: (
      transaction: { to: `0x${string}`; value: bigint; data?: `0x${string}` },
      options?: { address?: string },
    ) => Promise<{ hash: `0x${string}` }>;
    selectedWallet?: any;
  },
  route?: any
): Promise<ExecutionResult> {
  if (!route) {
    throw new ExecutionError(
      "No route data available for bridge-swap execution",
      "ROUTE_MISSING"
    );
  }

  try {
    console.log("🔄 Executing bridge-swap via LI.FI...", {
      fromToken: norm.fromToken.symbol,
      toToken: norm.toToken.symbol,
      fromChain: norm.fromChainId,
      toChain: norm.toChainId,
    });

    // Extract transaction data from route (already prepared during planning phase)
    const firstStep = route.steps?.[0];
    if (!firstStep?.transactionRequest) {
      throw new ExecutionError(
        "Route missing transaction request data",
        "INVALID_ROUTE_DATA"
      );
    }

    const txRequest = firstStep.transactionRequest;
    console.log("✅ Extracted transaction data from route:", {
      to: txRequest.to,
      value: txRequest.value,
      hasData: !!txRequest.data,
    });

    // Execute transaction
    let txHash: string;

    if (accountMode === "SMART_ACCOUNT") {
      txHash = await clients.smartWalletClient!.sendTransaction({
        to: txRequest.to as `0x${string}`,
        value: BigInt(txRequest.value || 0),
        data: txRequest.data as `0x${string}`,
      });
    } else {
      try {
        const txResult = await clients.eoaSendTransaction!({
          to: txRequest.to as `0x${string}`,
          value: BigInt(txRequest.value || 0),
          data: txRequest.data as `0x${string}`,
        }, {
          address: clients.selectedWallet!.address,
        });
        txHash = txResult.hash;
      } catch (sendError: any) {
        console.error("❌ EOA sendTransaction error:", sendError);
        
        if (sendError.name === "EstimateGasExecutionError" || sendError.message?.includes("execution reverted")) {
          throw new ExecutionError(
            `Transaction validation failed: ${sendError.details || sendError.message}. This may be due to insufficient balance, slippage, or liquidity issues.`,
            "TRANSACTION_REVERTED"
          );
        }
        
        throw sendError;
      }
    }

    const fromChainConfig = getChainConfig(norm.fromChainId);
    const toChainConfig = getChainConfig(norm.toChainId);
    const explorerUrl = getTxUrl(norm.fromChainId, txHash);

    return {
      success: true,
      txHash,
      message: `✅ Bridge-swap initiated: ${fromChainConfig?.name} ${norm.fromToken.symbol} → ${toChainConfig?.name} ${norm.toToken.symbol}`,
      explorerUrl,
    };
  } catch (error: any) {
    console.error("❌ Bridge-swap execution error:", error);
    
    if (error instanceof ExecutionError) {
      throw error;
    }
    
    if (error.message?.includes("user rejected") || error.message?.includes("User rejected") || error.code === "ACTION_REJECTED") {
      throw new ExecutionError(
        "Transaction was cancelled by user",
        "USER_REJECTED"
      );
    }
    
    if (error.message?.includes("insufficient funds") || error.message?.includes("insufficient balance")) {
      throw new ExecutionError(
        "Insufficient balance to complete bridge-swap (including gas fees)",
        "INSUFFICIENT_FUNDS"
      );
    }
    
    throw new ExecutionError(
      `Bridge-swap execution failed: ${error.message || "Unknown error"}`,
      "BRIDGE_SWAP_EXECUTION_FAILED"
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
      transaction: { to: `0x${string}`; value: bigint; data?: `0x${string}` },
      options?: { address?: string },
    ) => Promise<{ hash: `0x${string}` }>;
    selectedWallet?: any;
  },
  route?: any
): Promise<ExecutionResult> {
  console.log({clientnih: clients})
  if (norm.kind === "native-transfer") {
    return executeNativeTransfer(norm, accountMode, clients);
  } else if (norm.kind === "erc20-transfer") {
    return executeERC20Transfer(norm, accountMode, clients);
  } else if (norm.kind === "swap") {
    return executeSwap(norm, accountMode, clients, route);
  } else if (norm.kind === "bridge") {
    return executeBridge(norm, accountMode, clients, route);
  } else if (norm.kind === "bridge-swap") {
    return executeBridgeSwap(norm, accountMode, clients, route);
  } else {
    throw new ExecutionError(
      `Unsupported transfer type: ${(norm as any).kind}`,
      "UNSUPPORTED_TRANSFER_TYPE",
    );
  }
}

/**
 * Get Smart Account address from user's linked accounts
 * Note: Privy Smart Wallet address is available through user.linkedAccounts, not client.getAddress()
 */
export function getSmartAccountAddress(
  smartAccountAddress: `0x${string}` | undefined,
): `0x${string}` {
  if (!smartAccountAddress) {
    throw new ExecutionError(
      "Smart Account address not available. Please ensure you're logged in and have a Smart Wallet.",
      "ADDRESS_NOT_AVAILABLE",
    );
  }

  if (
    !smartAccountAddress.startsWith("0x") ||
    smartAccountAddress.length !== 42
  ) {
    throw new ExecutionError(
      "Invalid Smart Account address format",
      "INVALID_ADDRESS",
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
 * Format execution error for user display (Enhanced with LI.FI errors)
 */
export function formatExecutionError(error: ExecutionError): string {
  const errorMessages: Record<string, string> = {
    // Existing Privy/blockchain errors
    CLIENT_NOT_AVAILABLE:
      "⚠️ Smart Account not ready. Please refresh and try again.",
    INSUFFICIENT_FUNDS: "💰 Insufficient balance for transaction + gas fees.",
    USER_REJECTED: "❌ Transaction was canceled by user.",
    GAS_ERROR: "⛽ Gas estimation failed. Try a smaller amount.",
    NONCE_ERROR: "🔄 Transaction ordering error. Please try again.",
    BUNDLER_ERROR: "🌐 Network congestion. Please try again in a moment.",
    NETWORK_ERROR: "📡 Network connection error. Check your connection.",
    NO_TX_HASH: "❌ Transaction failed to submit properly.",
    EXECUTION_FAILED: "❌ Transaction execution failed.",

    // New LI.FI-specific errors
    LIFI_PREPARATION_FAILED:
      "🔗 LI.FI route preparation failed. Please try again.",
    LIFI_PREPARATION_REQUEST_FAILED:
      "🌐 LI.FI service unavailable. Please try again.",
    NO_ROUTES_FOUND: "🚫 No routing available for this transaction.",
    ROUTE_SELECTION_FAILED: "🔗 Failed to find optimal route.",
    QUOTE_EXPIRED: "⏰ Route quote expired. Please try again.",
    CHAIN_CONFIG_MISSING:
      "⚙️ Chain configuration error. Please contact support.",
    RATE_LIMIT_EXCEEDED: "⏱️ Too many requests. Please wait a moment.",
    SDK_ERROR: "🔗 LI.FI SDK error. Please try again.",
    API_ERROR: "🌐 LI.FI API error. Please try again later.",
    VALIDATION_ERROR: "❌ Invalid transaction data. Please check parameters.",
  };

  return errorMessages[error.code] || `❌ ${error.message}`;
}
