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
  norm: NormalizedNativeTransfer
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
    const saAddress = await biconomyClient.getAddress();
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

    console.log({ biconomyClient });
    const signerAddress = await biconomyClient?.signer?.getAddress?.()
    console.log({ signerAddress})
    // Execute transaction via Biconomy Smart Account using correct SDK format
    const biconomyTransactionResponse = await biconomyClient.sendTransaction({
          to: norm.to,
          value: norm.amountWei,
          data: "0x", // No data for native transfer
    });

    console.log({ biconomyTransactionResponse });


    console.log({ wait: biconomyTransactionResponse?.wait });

    // Wait for transaction and get the hash
    const {
      receipt: { transactionHash },
      success,
    } = await biconomyTransactionResponse?.wait();

    console.log({ transactionHash, success });

    if (!success) {
      throw new ExecutionError(
        "Transaction failed during execution",
        "TRANSACTION_FAILED"
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
  } = {}
): Promise<{
  txHash: string;
  confirmed?: boolean;
}> {
  const { waitForConfirmation = true, timeoutMs = 30000 } = options;

  // Execute the transaction
  const txHash = await executeNativeTransfer(biconomyClient, norm);

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
