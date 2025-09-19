// lib/execute.ts - Transaction execution via Biconomy Smart Accounts

import type { NormalizedNativeTransfer } from "./normalize";

// Global transaction queue to prevent nonce conflicts
const transactionQueue = new Map<string, Promise<any>>();

export class ExecutionError extends Error {
  constructor(message: string, public code: string, public txHash?: string) {
    super(message);
    this.name = "ExecutionError";
  }
}

/**
 * Execute native ETH transfer via Biconomy Smart Account
 * @param biconomyClient - The smart account client (regular or session-enabled)
 * @param norm - Normalized transfer parameters
 * @param userAddress - Optional user address for logging
 * @param useSession - Whether this is a session key transaction
 */
/**
 * Serialize transactions for a specific smart account to prevent nonce conflicts
 */
async function queueTransaction<T>(accountAddress: string, operation: () => Promise<T>): Promise<T> {
  const existingPromise = transactionQueue.get(accountAddress);

  const newPromise = existingPromise
    ? existingPromise.catch(() => {}).then(() => operation())
    : operation();

  transactionQueue.set(accountAddress, newPromise);

  try {
    const result = await newPromise;
    // Clean up completed transaction from queue
    if (transactionQueue.get(accountAddress) === newPromise) {
      transactionQueue.delete(accountAddress);
    }
    return result;
  } catch (error) {
    // Clean up failed transaction from queue
    if (transactionQueue.get(accountAddress) === newPromise) {
      transactionQueue.delete(accountAddress);
    }
    throw error;
  }
}

export async function executeNativeTransfer(
  biconomyClient: any,
  norm: NormalizedNativeTransfer,
  userAddress?: `0x${string}`,
  useSession?: boolean
): Promise<string> {
  // Get smart account address for queuing
  const saAddress = userAddress || biconomyClient.account?.address || "unknown";

  // Queue this transaction to prevent nonce conflicts
  return queueTransaction(saAddress, async () => {
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
      const sessionInfo = useSession ? " (via session key)" : "";
      const attemptInfo = attempt > 1 ? ` (attempt ${attempt}/${maxRetries})` : "";
      console.log(
        `Executing transfer${sessionInfo}${attemptInfo} from SA ${saAddress} to ${norm.to} on chain ${
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
        attempt
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

      // Add delay and nonce synchronization between retries
      if (attempt > 1) {
        const delayMs = Math.min(1000 * (attempt - 1), 3000); // 1s, 2s, 3s max
        console.log(`⏱️ Waiting ${delayMs}ms before retry to allow nonce synchronization...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));

        // Additional delay for bundler mempool synchronization
        console.log("🔄 Allowing extra time for bundler mempool to sync...");
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Fetch fresh nonce before each attempt to ensure accuracy
      let currentNonce;
      try {
        console.log("🔍 Fetching current nonce from smart account...");

        // Check if the client has getNonce method (AbstractJS pattern)
        if (typeof biconomyClient.getNonce === 'function') {
          currentNonce = await biconomyClient.getNonce();
          console.log("✅ Current nonce fetched:", currentNonce?.toString());
        } else if (typeof biconomyClient.account?.getNonce === 'function') {
          currentNonce = await biconomyClient.account.getNonce();
          console.log("✅ Current nonce fetched from account:", currentNonce?.toString());
        } else {
          console.log("⚠️ getNonce method not found, proceeding with automatic nonce handling");
        }
      } catch (nonceError) {
        console.warn("⚠️ Failed to fetch nonce, proceeding with automatic handling:", nonceError);
      }

      // Prepare user operation parameters
      const userOpParams: any = {
        calls: [{
          to: norm.to,
          value: norm.amountWei,
          data: "0x", // No data for native transfer
        }]
      };

      // If we have a fresh nonce, explicitly set it in the UserOperation for retry attempts
      if (currentNonce !== undefined && attempt > 1) {
        // For retry attempts, ensure we're using the latest nonce
        console.log(`🔄 Setting explicit nonce for retry: ${currentNonce.toString()}`);
        userOpParams.nonce = currentNonce;
      }

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

      const logPrefix = useSession ? "✅ Session transaction sent:" : "✅ Transaction sent:";
      console.log(`${logPrefix} ${transactionHash}`);
      return transactionHash;

    } catch (error: any) {
      lastError = error;

      // Enhanced nonce conflict detection for various error patterns
      const errorMessage = error?.message || "";
      const errorCode = error?.code || "";
      const errorResponse = error?.response?.data || "";
      const errorStatus = error?.status || error?.response?.status;

      console.log("🔍 Analyzing error for nonce conflict:", {
        errorMessage,
        errorCode,
        errorResponse,
        errorStatus,
        fullError: error
      });

      // Check for funding issues first (not nonce conflicts)
      const isFundingIssue = errorMessage.includes("AA21 didn't pay prefund") ||
                             errorMessage.includes("Smart Account does not have sufficient funds") ||
                             errorCode === "INSUFFICIENT_FUNDS";

      const isNonceConflict =
        // Only check for nonce conflicts if it's not a funding issue
        !isFundingIssue && (
          // Direct nonce error codes
          errorCode === "NONCE_EXPIRED" ||
          errorCode === "NONCE_CONFLICT" ||
          // Message patterns for nonce conflicts
          errorMessage.toLowerCase().includes("nonce") ||
          errorMessage.includes("Transaction nonce conflict") ||
          // HTTP response patterns
          (errorStatus === 400 && (
            errorMessage.includes("nonce") ||
            errorResponse.includes("nonce") ||
            errorMessage.includes("conflict")
          )) ||
          // Bundler-specific patterns
          errorMessage.includes("UserOperation failed during simulation") ||
          // Check if error is a fetch/network error with nonce in response
          (error?.response && JSON.stringify(error.response).includes("nonce")) ||
          // Check for any axios/fetch errors that might contain nonce info
          (typeof errorResponse === "string" && errorResponse.toLowerCase().includes("nonce"))
        );

      // If it's a funding issue, don't retry - break immediately
      if (isFundingIssue) {
        console.warn("💰 Funding issue detected - no point in retrying");
        break;
      }

      // If it's a nonce conflict and we haven't exhausted retries, continue to next attempt
      if (isNonceConflict && attempt < maxRetries) {
        console.warn(`🔄 Nonce conflict detected, retrying (${attempt}/${maxRetries})...`);
        continue;
      }

      // If it's the last attempt or not a retryable error, fall through to error handling
      break;
    }
  }

  // If we get here, all retries failed - handle the last error
  const error = lastError;

  // Handle different error types from Biconomy
  if (error?.code === "UNPREDICTABLE_GAS_LIMIT") {
    throw new ExecutionError(
      "Transaction would likely fail. Check recipient address and amount",
      "UNPREDICTABLE_GAS_LIMIT"
    );
  }

  if (error?.code === "INSUFFICIENT_FUNDS" || error?.message?.includes("AA21 didn't pay prefund")) {
    throw new ExecutionError(
      "Smart account needs ETH for gas fees. Please send at least 0.001 ETH to your smart account address",
      "INSUFFICIENT_FUNDS"
    );
  }

  if (error?.code === "NONCE_EXPIRED" || error?.message?.includes("nonce")) {
    throw new ExecutionError(
      "Transaction nonce conflict persisted after retries. Please wait and try again",
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
  }); // Close queueTransaction
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
    useSession?: boolean;
  } = {}
): Promise<{
  txHash: string;
  confirmed?: boolean;
}> {
  const { waitForConfirmation = true, timeoutMs = 30000, userAddress, useSession } = options;

  // Execute the transaction
  const txHash = await executeNativeTransfer(biconomyClient, norm, userAddress, useSession);

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
