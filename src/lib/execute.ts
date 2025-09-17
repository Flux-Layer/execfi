// lib/execute.ts - Transaction execution via Biconomy Smart Accounts

import type { NormalizedNativeTransfer } from "./normalize";

export class ExecutionError extends Error {
  constructor(message: string, public code: string, public txHash?: string) {
    super(message);
    this.name = "ExecutionError";
  }
}

/**
 * Execute native ETH transfer via Biconomy Smart Account
 */
export async function executeNativeTransfer(
  biconomyClient: any,
  norm: NormalizedNativeTransfer,
  userAddress?: `0x${string}`
): Promise<string> {
  try {
    // Validate client
    if (!biconomyClient) {
      throw new ExecutionError(
        "Biconomy client not initialized",
        "CLIENT_NOT_INITIALIZED"
      );
    }

    // Get smart account address for logging
    // With AbstractJS, we get the address from the client's account property or use the passed userAddress
    const saAddress = userAddress || biconomyClient.account?.address || "unknown";
    console.log(
      `Executing transfer from SA ${saAddress} to ${norm.to} on chain ${
        norm.chainId
      }: \n ${{
        to: norm.to,
        value: norm.amountWei,
        data: "0x", // No data for native transfer
      }}`
    );

    console.log({
      to: norm.to,
      value: norm.amountWei,
      data: "0x", // No data for native transfer
    });

    console.log("🔍 Debug biconomyClient:", {
      biconomyClient,
      sendUserOperationMethod: typeof biconomyClient?.sendUserOperation,
      waitForUserOperationReceiptMethod: typeof biconomyClient?.waitForUserOperationReceipt,
      keys: biconomyClient ? Object.keys(biconomyClient) : []
    });

    // Check if client has the correct AbstractJS methods
    if (!biconomyClient?.sendUserOperation || typeof biconomyClient.sendUserOperation !== 'function') {
      throw new ExecutionError(
        "Biconomy client missing sendUserOperation method - client not properly initialized",
        "CLIENT_MISSING_METHOD"
      );
    }

    if (!biconomyClient?.waitForUserOperationReceipt || typeof biconomyClient.waitForUserOperationReceipt !== 'function') {
      throw new ExecutionError(
        "Biconomy client missing waitForUserOperationReceipt method - client not properly initialized",
        "CLIENT_MISSING_METHOD"
      );
    }

    const userOpParams = {
      calls: [{
        to: norm.to,
        value: norm.amountWei,
        data: "0x", // No data for native transfer
      }]
    };

    console.log("🚀 Sending user operation with params:", userOpParams);

    // Execute transaction via Biconomy Smart Account using correct AbstractJS pattern
    const hash = await biconomyClient.sendUserOperation(userOpParams);

    console.log("📧 User operation hash:", hash);

    if (!hash) {
      throw new ExecutionError(
        "Transaction failed: No hash returned from sendUserOperation",
        "NO_TRANSACTION_HASH"
      );
    }

    console.log("⏳ Waiting for user operation receipt...");

    // Wait for user operation receipt using AbstractJS pattern
    const receipt = await biconomyClient.waitForUserOperationReceipt({ hash });

    console.log("📋 User operation receipt:", receipt);

    if (!receipt) {
      throw new ExecutionError(
        "Transaction wait failed: No receipt returned",
        "NO_RECEIPT"
      );
    }

    // Extract transaction hash from receipt
    const transactionHash = receipt.receipt?.transactionHash || hash;

    // Check if the user operation was successful (AbstractJS pattern)
    const success = receipt.success !== false; // Default to true if success field is not present

    console.log({ transactionHash, success, receipt });

    if (!success) {
      throw new ExecutionError(
        "User operation execution failed",
        "USER_OPERATION_FAILED",
        transactionHash
      );
    }

    if (!transactionHash || typeof transactionHash !== "string") {
      throw new ExecutionError(
        "Failed to get transaction hash from Biconomy client",
        "NO_TX_HASH"
      );
    }

    console.log(`✅ Transaction sent: ${transactionHash}`);
    return transactionHash;
  } catch (error: any) {
    // Handle different error types from Biconomy
    if (error?.code === "UNPREDICTABLE_GAS_LIMIT") {
      throw new ExecutionError(
        "Transaction would likely fail. Check recipient address and amount",
        "UNPREDICTABLE_GAS_LIMIT"
      );
    }

    if (error?.code === "INSUFFICIENT_FUNDS") {
      throw new ExecutionError(
        "Insufficient funds for transaction + gas",
        "INSUFFICIENT_FUNDS"
      );
    }

    if (error?.code === "NONCE_EXPIRED" || error?.message?.includes("nonce")) {
      throw new ExecutionError(
        "Transaction nonce conflict. Please try again",
        "NONCE_CONFLICT"
      );
    }

    if (error?.code === "REPLACEMENT_UNDERPRICED") {
      throw new ExecutionError(
        "Gas price too low for network conditions. Please try again",
        "GAS_PRICE_LOW"
      );
    }

    if (
      error?.code === "NETWORK_ERROR" ||
      error?.message?.includes("network")
    ) {
      throw new ExecutionError(
        "Network error. Please check your connection and try again",
        "NETWORK_ERROR"
      );
    }

    // Handle HTTP/API errors first
    if (error?.message?.includes("404") || error?.status === 404) {
      throw new ExecutionError(
        "Biconomy API endpoint not found. Please check bundler URL configuration",
        "API_ENDPOINT_NOT_FOUND"
      );
    }

    if (error?.message?.includes("401") || error?.status === 401) {
      throw new ExecutionError(
        "Biconomy API authentication failed. Please check your API key",
        "API_AUTHENTICATION_FAILED"
      );
    }

    if (error?.message?.includes("403") || error?.status === 403) {
      throw new ExecutionError(
        "Biconomy API access forbidden. Please verify your API key permissions",
        "API_ACCESS_FORBIDDEN"
      );
    }

    // Handle Biconomy-specific errors
    if (error?.message?.includes("bundler")) {
      throw new ExecutionError(
        "Bundler rejected transaction. Please try again with different amount",
        "BUNDLER_REJECTED"
      );
    }

    if (error?.message?.includes("paymaster")) {
      throw new ExecutionError(
        "Paymaster error. Transaction may require manual gas payment",
        "PAYMASTER_ERROR"
      );
    }

    if (error?.message?.includes("Smart account not deployed")) {
      throw new ExecutionError(
        "Smart account deployment required. This transaction will deploy your account",
        "ACCOUNT_DEPLOYMENT_REQUIRED"
      );
    }

    // Generic error handling
    console.error("Execution error:", error);

    throw new ExecutionError(
      `Transaction failed: ${error?.message || "Unknown error"}`,
      "EXECUTION_FAILED"
    );
  }
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransactionConfirmation(
  txHash: string,
  chainId: number,
  timeoutMs = 30000 // 30 seconds timeout
): Promise<boolean> {
  const startTime = Date.now();

  // TODO: Implement proper transaction receipt polling
  // For MVP, we'll just return true after a short delay
  // In production, this should poll the RPC for transaction receipts

  return new Promise((resolve, reject) => {
    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;

      if (elapsed >= timeoutMs) {
        clearInterval(checkInterval);
        reject(
          new ExecutionError(
            "Transaction confirmation timeout",
            "CONFIRMATION_TIMEOUT",
            txHash
          )
        );
        return;
      }

      // For MVP, assume transaction confirms after 5 seconds
      if (elapsed >= 5000) {
        clearInterval(checkInterval);
        resolve(true);
        return;
      }
    }, 1000);
  });
}

/**
 * Get transaction status from chain
 */
export async function getTransactionStatus(): Promise<
  "pending" | "confirmed" | "failed"
> {
  // TODO: Implement proper RPC polling for transaction status
  // For MVP, we'll return a simple status based on time

  return "confirmed"; // Simplified for MVP
}

/**
 * Main orchestrator function - executes the full pipeline
 */
export async function executeTransferPipeline(
  biconomyClient: any,
  norm: NormalizedNativeTransfer,
  options: {
    waitForConfirmation?: boolean;
    timeoutMs?: number;
    userAddress?: `0x${string}`;
  } = {}
): Promise<{
  txHash: string;
  confirmed?: boolean;
}> {
  const { waitForConfirmation = true, timeoutMs = 30000, userAddress } = options;

  // Execute the transaction
  const txHash = await executeNativeTransfer(biconomyClient, norm, userAddress);

  // Optionally wait for confirmation
  if (waitForConfirmation) {
    try {
      const confirmed = await waitForTransactionConfirmation(
        txHash,
        norm.chainId,
        timeoutMs
      );
      return { txHash, confirmed };
    } catch (error) {
      // Return txHash even if confirmation times out
      console.warn(
        "Confirmation timeout, but transaction may still succeed:",
        error
      );
      return { txHash, confirmed: false };
    }
  }

  return { txHash };
}
