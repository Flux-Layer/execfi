// lib/orchestrator.ts - Main orchestration pipeline

import {
  parseIntent,
  isIntentSuccess,
  isIntentClarify,
  isTransferIntent,
  type Intent,
} from "./ai";
import { normalizeIntent, TokenSelectionError } from "./normalize";
import { validateNoDuplicate, updateTransactionStatus } from "./idempotency";
import { validateIntent, simulateIntent } from "./validation";
import { executeIntent, getSmartAccountAddress, formatExecutionError } from "./execute";
import { monitorTransaction, formatMonitoringStatus } from "./monitor";

export class OrchestrationError extends Error {
  constructor(
    message: string,
    public code: string,
    public phase: "intent" | "normalize" | "validate" | "execute" | "monitor",
  ) {
    super(message);
    this.name = "OrchestrationError";
  }
}

export interface OrchestrationContext {
  userId: string;
  smartWalletClient?: any; // Privy Smart Wallet client
  smartAccountAddress?: `0x${string}`; // Smart Account address from user.linkedAccounts
}

export interface OrchestrationResult {
  success: true;
  message: string;
  txHash?: string;
  explorerUrl?: string;
}

export interface OrchestrationClarification {
  success: false;
  clarify: string;
  missing: string[];
}

export interface OrchestrationTokenSelection {
  success: false;
  tokenSelection: {
    message: string;
    tokens: {
      id: number;
      chainId: number;
      address: string;
      name: string;
      symbol: string;
      logoURI?: string;
      verified?: boolean;
    }[];
  };
}

export type OrchestrationResponse =
  | OrchestrationResult
  | OrchestrationClarification
  | OrchestrationTokenSelection;

/**
 * Main orchestration function - executes the full pipeline
 */
export async function orchestrateTransaction(
  prompt: string,
  ctx: OrchestrationContext,
): Promise<OrchestrationResponse> {
  let promptId: string | undefined;

  try {
    // Phase 1: Intent Parsing
    console.log("🔄 Phase 1: Parsing intent...");
    const intentResult: Intent = await parseIntent(prompt);

    if (isIntentClarify(intentResult)) {
      return {
        success: false,
        clarify: intentResult.clarify,
        missing: intentResult.missing,
      };
    }

    if (
      !isIntentSuccess(intentResult) ||
      !isTransferIntent(intentResult.intent)
    ) {
      throw new OrchestrationError(
        "Only native ETH transfers are supported in MVP",
        "UNSUPPORTED_INTENT",
        "intent",
      );
    }

    console.log("✅ Intent parsed successfully:", intentResult.intent);

    // Phase 2: Normalization
    console.log("🔄 Phase 2: Normalizing intent...");
    const norm = normalizeIntent(intentResult);
    console.log("✅ Intent normalized:", norm);

    // Phase 3: Idempotency Check
    console.log("🔄 Phase 3: Checking for duplicates...");
    promptId = validateNoDuplicate(ctx.userId, norm);
    console.log("✅ No duplicates found, promptId:", promptId);

    // Phase 4: Validate Smart Wallet Client and Address
    if (!ctx.smartWalletClient) {
      throw new OrchestrationError(
        "Smart Wallet client not available. Please ensure you're logged in.",
        "CLIENT_NOT_AVAILABLE",
        "validate"
      );
    }

    console.log("🔄 Phase 4: Validating Smart Account address...");
    const smartAccountAddress = getSmartAccountAddress(ctx.smartAccountAddress);
    console.log("✅ Smart Account address:", smartAccountAddress);

    // Phase 5: Validation
    console.log("🔄 Phase 5: Validating transaction...");
    const { gasEstimate, gasCost } = await validateIntent(norm, smartAccountAddress);
    console.log("✅ Validation passed", { gasEstimate, gasCost });

    // Phase 6: Simulation (optional but recommended)
    console.log("🔄 Phase 6: Simulating transaction...");
    await simulateIntent(norm, smartAccountAddress);
    console.log("✅ Simulation successful");

    // Phase 7: Execution
    console.log("🔄 Phase 7: Executing transaction...");
    const executionResult = await executeIntent(ctx.smartWalletClient, norm);
    console.log("✅ Transaction executed:", executionResult.txHash);

    // Phase 8: Monitoring (optional - immediate return for better UX)
    console.log("🔄 Phase 8: Transaction submitted, monitoring in background...");

    // Update idempotency with success
    updateTransactionStatus(promptId, "completed", executionResult.txHash);

    // Return success immediately with monitoring in background
    // The UI can show the transaction hash immediately while monitoring continues
    monitorTransaction(norm.chainId, executionResult.txHash as any).then(status => {
      console.log("📊 Final transaction status:", formatMonitoringStatus(status));
    }).catch(error => {
      console.warn("⚠️ Transaction monitoring failed:", error.message);
    });

    return {
      success: true,
      message: executionResult.message,
      txHash: executionResult.txHash,
      explorerUrl: executionResult.explorerUrl,
    };
  } catch (error: any) {
    // Handle token selection error specially
    if (error instanceof TokenSelectionError) {
      return {
        success: false,
        tokenSelection: {
          message: error.message,
          tokens: error.tokens.map((token) => ({
            id: token.id,
            chainId: token.chainId,
            address: token.address,
            name: token.name,
            symbol: token.symbol,
            logoURI: token.logoURI,
            verified: token.verified,
          })),
        },
      };
    }

    // Update idempotency status on failure
    if (promptId) {
      updateTransactionStatus(promptId, "failed");
    }

    console.error("Orchestration error:", error);

    // Re-throw with context if it's already an orchestration error
    if (error instanceof OrchestrationError) {
      throw error;
    }

    // Handle ExecutionError and MonitoringError specifically
    if (error.name === "ExecutionError") {
      throw new OrchestrationError(
        formatExecutionError(error),
        error.code,
        "execute"
      );
    }

    if (error.name === "MonitoringError") {
      throw new OrchestrationError(
        error.message,
        error.code,
        "monitor"
      );
    }

    // Map specific errors to orchestration errors
    const errorMessage = error?.message || "Unknown error";
    const errorCode = error?.code || "UNKNOWN_ERROR";

    // Determine phase based on error type and code
    let phase: OrchestrationError["phase"] = "execute";

    if (errorMessage.includes("parse") || errorMessage.includes("intent")) {
      phase = "intent";
    } else if (
      errorMessage.includes("normalize") ||
      errorMessage.includes("chain") ||
      errorMessage.includes("address") ||
      errorCode === "CHAIN_UNSUPPORTED"
    ) {
      phase = "normalize";
    } else if (
      errorMessage.includes("balance") ||
      errorMessage.includes("gas") ||
      errorMessage.includes("validate") ||
      errorMessage.includes("CLIENT_NOT_AVAILABLE") ||
      errorCode === "INSUFFICIENT_FUNDS" ||
      errorCode === "INSUFFICIENT_FUNDS_WITH_GAS" ||
      errorCode === "BALANCE_TOO_LOW_AFTER_TX" ||
      errorCode === "GAS_ESTIMATION_FAILED" ||
      errorCode === "AMOUNT_EXCEEDS_LIMIT" ||
      errorCode === "ZERO_ADDRESS" ||
      errorCode === "SIMULATION_FAILED"
    ) {
      phase = "validate";
    }

    throw new OrchestrationError(errorMessage, errorCode, phase);
  }
}

/**
 * Simplified orchestration for terminal use
 */
export async function executeTransactionFromPrompt(
  prompt: string,
  userId: string,
  smartWalletClient?: any,
  smartAccountAddress?: `0x${string}`,
): Promise<OrchestrationResponse> {
  return orchestrateTransaction(prompt, {
    userId,
    smartWalletClient,
    smartAccountAddress,
  });
}

/**
 * Helper to format error messages for terminal display
 */
export function formatOrchestrationError(error: OrchestrationError): string {
  const phaseEmojis = {
    intent: "🤖",
    normalize: "🔄",
    validate: "⚖️",
    execute: "⚡",
    monitor: "👀",
  };

  const emoji = phaseEmojis[error.phase] || "⚠️";
  return `${emoji} ${error.message}`;
}
