// lib/errors/transaction-handler.ts - Graceful transaction error handling

/**
 * Categorized transaction error types
 */
export enum TransactionErrorType {
  USER_REJECTED = "USER_REJECTED",
  INSUFFICIENT_GAS = "INSUFFICIENT_GAS",
  INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",
  APPROVAL_REQUIRED = "APPROVAL_REQUIRED",
  EXECUTION_REVERTED = "EXECUTION_REVERTED",
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT = "TIMEOUT",
  NONCE_ERROR = "NONCE_ERROR",
  SLIPPAGE_ERROR = "SLIPPAGE_ERROR",
  CONTRACT_ERROR = "CONTRACT_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * Structured transaction error with user-friendly messaging
 */
export class TransactionError extends Error {
  public readonly type: TransactionErrorType;
  public readonly userMessage: string;
  public readonly technicalMessage: string;
  public readonly originalError: any;
  public readonly isRecoverable: boolean;
  public readonly suggestedAction?: string;

  constructor(
    type: TransactionErrorType,
    userMessage: string,
    technicalMessage: string,
    originalError: any,
    isRecoverable: boolean = false,
    suggestedAction?: string
  ) {
    super(userMessage);
    this.name = "TransactionError";
    this.type = type;
    this.userMessage = userMessage;
    this.technicalMessage = technicalMessage;
    this.originalError = originalError;
    this.isRecoverable = isRecoverable;
    this.suggestedAction = suggestedAction;
  }

  /**
   * Get a formatted error message for display
   */
  getDisplayMessage(): string {
    let message = `❌ ${this.userMessage}`;
    if (this.suggestedAction) {
      message += `\n\n💡 ${this.suggestedAction}`;
    }
    return message;
  }

  /**
   * Check if error should trigger a retry
   */
  shouldRetry(): boolean {
    return this.isRecoverable && [
      TransactionErrorType.NETWORK_ERROR,
      TransactionErrorType.TIMEOUT,
      TransactionErrorType.NONCE_ERROR,
    ].includes(this.type);
  }
}

/**
 * Parse and categorize transaction errors from Privy/viem
 */
export function parseTransactionError(error: any, context?: string): TransactionError {
  const errorMessage = error?.message || error?.toString() || "Unknown error";
  const errorCode = error?.code;
  const errorName = error?.name;
  const errorDetails = error?.details;

  console.error("🔍 Transaction error details:", {
    message: errorMessage,
    code: errorCode,
    name: errorName,
    details: errorDetails,
    context,
  });

  // 1. User Rejection
  if (
    errorCode === 4001 ||
    errorCode === "ACTION_REJECTED" ||
    errorMessage.toLowerCase().includes("user rejected") ||
    errorMessage.toLowerCase().includes("user denied") ||
    errorMessage.toLowerCase().includes("user cancelled") ||
    errorMessage.toLowerCase().includes("rejected by user")
  ) {
    return new TransactionError(
      TransactionErrorType.USER_REJECTED,
      "Transaction cancelled",
      "User rejected the transaction in their wallet",
      error,
      false,
      "You can try again when you're ready to proceed."
    );
  }

  // 2. Insufficient Gas
  if (
    errorMessage.includes("insufficient funds for gas") ||
    errorMessage.includes("gas required exceeds allowance") ||
    errorMessage.includes("out of gas") ||
    errorMessage.includes("intrinsic gas too low")
  ) {
    return new TransactionError(
      TransactionErrorType.INSUFFICIENT_GAS,
      "Insufficient funds for gas",
      "Not enough native token (ETH/MATIC/etc.) to pay for transaction gas",
      error,
      false,
      "Add more native tokens to your wallet to cover gas fees."
    );
  }

  // 3. Insufficient Funds
  if (
    errorMessage.includes("insufficient funds") ||
    errorMessage.includes("insufficient balance") ||
    errorMessage.includes("exceeds balance")
  ) {
    return new TransactionError(
      TransactionErrorType.INSUFFICIENT_FUNDS,
      "Insufficient token balance",
      "Not enough tokens to complete the transaction",
      error,
      false,
      "Check your balance and try with a smaller amount."
    );
  }

  // 4. Approval Required
  if (
    errorMessage.includes("TRANSFER_FROM_FAILED") ||
    errorMessage.includes("ERC20: insufficient allowance") ||
    errorMessage.includes("transfer amount exceeds allowance") ||
    errorMessage.includes("ERC20: transfer amount exceeds allowance")
  ) {
    return new TransactionError(
      TransactionErrorType.APPROVAL_REQUIRED,
      "Token approval required",
      "Token needs to be approved before it can be transferred",
      error,
      true,
      "The system will automatically request token approval. Please approve in your wallet."
    );
  }

  // 5. Slippage Error
  if (
    errorMessage.includes("slippage") ||
    errorMessage.includes("price impact too high") ||
    errorMessage.includes("INSUFFICIENT_OUTPUT_AMOUNT") ||
    errorMessage.includes("Too little received")
  ) {
    return new TransactionError(
      TransactionErrorType.SLIPPAGE_ERROR,
      "Price changed too much",
      "Token price moved beyond acceptable slippage tolerance",
      error,
      true,
      "Try again with a higher slippage tolerance or wait for better market conditions."
    );
  }

  // 6. Nonce Error
  if (
    errorMessage.includes("nonce") ||
    errorMessage.includes("already known") ||
    errorMessage.includes("replacement transaction underpriced")
  ) {
    return new TransactionError(
      TransactionErrorType.NONCE_ERROR,
      "Transaction conflict detected",
      "Nonce error or transaction already pending",
      error,
      true,
      "Please wait a moment and try again."
    );
  }

  // 7. Network Error
  if (
    errorMessage.includes("network") ||
    errorMessage.includes("connection") ||
    errorMessage.includes("timeout") ||
    errorMessage.includes("fetch failed") ||
    errorMessage.includes("ECONNREFUSED") ||
    errorCode === "NETWORK_ERROR"
  ) {
    return new TransactionError(
      TransactionErrorType.NETWORK_ERROR,
      "Network connection issue",
      "Failed to connect to blockchain network",
      error,
      true,
      "Check your internet connection and try again."
    );
  }

  // 8. Timeout
  if (
    errorMessage.includes("timeout") ||
    errorMessage.includes("timed out") ||
    errorCode === "TIMEOUT"
  ) {
    return new TransactionError(
      TransactionErrorType.TIMEOUT,
      "Transaction took too long",
      "Transaction confirmation timed out",
      error,
      true,
      "The transaction may still be processing. Check your wallet or try again."
    );
  }

  // 9. Execution Reverted (Generic contract errors)
  if (
    errorName === "EstimateGasExecutionError" ||
    errorMessage.includes("execution reverted") ||
    errorMessage.includes("revert") ||
    errorMessage.includes("contract call failed")
  ) {
    // Try to extract revert reason
    const revertReason = extractRevertReason(errorMessage, errorDetails);
    
    return new TransactionError(
      TransactionErrorType.EXECUTION_REVERTED,
      "Transaction would fail",
      `Contract execution reverted${revertReason ? `: ${revertReason}` : ""}`,
      error,
      false,
      "This might be due to insufficient balance, liquidity issues, or contract restrictions. Please check the transaction parameters."
    );
  }

  // 10. Contract Error (Smart contract specific)
  if (
    errorMessage.includes("contract") ||
    errorMessage.includes("function") ||
    errorCode === "CALL_EXCEPTION"
  ) {
    return new TransactionError(
      TransactionErrorType.CONTRACT_ERROR,
      "Smart contract error",
      "Error calling smart contract function",
      error,
      false,
      "The contract rejected the transaction. Please verify all parameters are correct."
    );
  }

  // 11. Unknown Error (Fallback)
  return new TransactionError(
    TransactionErrorType.UNKNOWN_ERROR,
    "Transaction failed",
    errorMessage,
    error,
    false,
    "An unexpected error occurred. Please try again or contact support if the issue persists."
  );
}

/**
 * Extract revert reason from error message
 */
function extractRevertReason(message: string, details?: string): string | null {
  // Try to extract from common patterns
  const patterns = [
    /reason: (.+?)(?:\n|$)/i,
    /revert (.+?)(?:\n|$)/i,
    /reverted with reason string '(.+?)'/i,
    /reverted: (.+?)(?:\n|$)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern) || details?.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Wrap transaction execution with graceful error handling
 */
export async function executeTransactionSafely<T>(
  transactionFn: () => Promise<T>,
  context: string,
  onError?: (error: TransactionError) => void
): Promise<{ success: true; data: T } | { success: false; error: TransactionError }> {
  try {
    const result = await transactionFn();
    return { success: true, data: result };
  } catch (error: any) {
    const transactionError = parseTransactionError(error, context);
    
    // Log for debugging
    console.error(`❌ [${context}] Transaction failed:`, {
      type: transactionError.type,
      userMessage: transactionError.userMessage,
      technicalMessage: transactionError.technicalMessage,
      isRecoverable: transactionError.isRecoverable,
    });

    // Call error handler if provided
    if (onError) {
      onError(transactionError);
    }

    return { success: false, error: transactionError };
  }
}

/**
 * Format error for user display in terminal/UI
 */
export function formatErrorForDisplay(error: TransactionError, includeDetails: boolean = false): string {
  const lines: string[] = [];
  
  lines.push("═".repeat(60));
  lines.push("❌ TRANSACTION ERROR");
  lines.push("═".repeat(60));
  lines.push("");
  lines.push(error.userMessage);
  
  if (error.suggestedAction) {
    lines.push("");
    lines.push("💡 What to do:");
    lines.push(error.suggestedAction);
  }

  if (includeDetails && error.technicalMessage) {
    lines.push("");
    lines.push("🔧 Technical details:");
    lines.push(error.technicalMessage);
  }

  if (error.isRecoverable) {
    lines.push("");
    lines.push("🔄 You can try again");
  }

  lines.push("");
  lines.push("═".repeat(60));

  return lines.join("\n");
}

/**
 * Log error to console with formatting
 */
export function logTransactionError(error: TransactionError, context?: string): void {
  console.error("\n" + formatErrorForDisplay(error, true));
  if (context) {
    console.error(`📍 Context: ${context}`);
  }
  console.error("\n🔍 Original error:", error.originalError);
}
