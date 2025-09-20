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
}

export interface OrchestrationResult {
  success: true;
  message: string;
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

    // Phase 4: Validation
    console.log("🔄 Phase 4: Validating transaction...");
    console.log("Real transaction implementation under development");

    return {
      success: true,
      message: "Dummy transaction executed",
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
): Promise<OrchestrationResponse> {
  return orchestrateTransaction(prompt, {
    userId,
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
