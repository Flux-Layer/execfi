// lib/orchestrator.ts - Main orchestration pipeline

import { formatEther } from "viem";
import {
  parseIntent,
  isIntentSuccess,
  isIntentClarify,
  isTransferIntent,
  type Intent,
} from "./ai";
import {
  normalizeIntent,
  type NormalizedNativeTransfer,
  TokenSelectionError,
} from "./normalize";
import { validateIntent, simulateIntent } from "./validation";
import { executeTransferPipeline } from "./execute";
import { validateNoDuplicate, updateTransactionStatus } from "./idempotency";
import { formatSuccessMessage, generateExplorerLink } from "./explorer";

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
  biconomyClient: any;
  sessionClient?: any;
  userAddress: `0x${string}`;
  hasActiveSession?: boolean;
  sendSessionTx?: (params: {
    to: string;
    value?: string;
    data?: string;
  }) => Promise<string>;
}

export interface OrchestrationResult {
  success: true;
  txHash: string;
  message: string;
  explorerLink: {
    url: string;
    text: string;
    explorerName: string;
  };
  norm: NormalizedNativeTransfer;
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

    // For smart accounts, we need to validate against the smart account address, not the EOA
    let validationAddress = ctx.userAddress;

    try {
      // Try to get smart account address from the client
      if (ctx.biconomyClient?.account?.address) {
        validationAddress = ctx.biconomyClient.account.address;
        console.log(
          "🔍 Using smart account address for validation:",
          validationAddress,
        );
      } else if (typeof ctx.biconomyClient?.getAddress === "function") {
        const smartAccountAddress = await ctx.biconomyClient.getAddress();
        if (smartAccountAddress) {
          validationAddress = smartAccountAddress;
          console.log(
            "🔍 Using smart account address for validation:",
            validationAddress,
          );
        }
      } else {
        console.log(
          "⚠️ Could not get smart account address, using EOA for validation:",
          validationAddress,
        );
      }
    } catch (error) {
      console.warn(
        "⚠️ Failed to get smart account address, using EOA for validation:",
        error,
      );
    }

    const { gasEstimate, gasCost } = await validateIntent(
      norm,
      validationAddress,
    );
    console.log(
      "✅ Validation passed - Gas estimate:",
      gasEstimate.toString(),
      "Gas cost:",
      formatEther(gasCost),
      "ETH",
    );

    // Phase 5: Simulation
    console.log("🔄 Phase 5: Simulating transaction...");
    await simulateIntent(norm, validationAddress);
    console.log("✅ Simulation successful");

    // Phase 6: Execution
    console.log("🔄 Phase 6: Executing transaction...");

    // For MVP, only native transfers are fully supported
    if (norm.kind !== "native-transfer") {
      throw new OrchestrationError(
        "Only native ETH transfers are supported for execution in MVP",
        "EXECUTION_NOT_SUPPORTED",
        "execute",
      );
    }

    // Determine if we should use session for automated approval
    const requestsSession = Boolean(intentResult.intent.useSession);
    const hasActiveSession = Boolean(ctx.hasActiveSession);
    const sessionExecutorReady = typeof ctx.sendSessionTx === "function";
    const useSessionFlow = requestsSession && hasActiveSession && sessionExecutorReady;

    if (requestsSession && !hasActiveSession) {
      throw new OrchestrationError(
        "Session not ready. Run 'create session' and try again.",
        "SESSION_NOT_READY",
        "execute",
      );
    }

    const clientToUse = ctx.biconomyClient;

    if (!clientToUse) {
      throw new OrchestrationError(
        "Smart account client not ready. Try 'retry' and wait for initialization.",
        "CLIENT_NOT_READY",
        "execute",
      );
    }

    // Enhanced logging for debugging
    console.log("🔍 SESSION DEBUG:", {
      intentUseSession: intentResult.intent.useSession,
      hasActiveSession,
      sessionExecutorReady,
      useSessionFlow,
    });

    // Log session usage status
    if (useSessionFlow) {
      console.log("✅ Using session permission for automated approval");
    } else {
      console.log(
        requestsSession
          ? "⚠️ Session requested but falling back to regular client"
          : "👤 Using regular client with user approval required",
      );
    }

    const { txHash } = await executeTransferPipeline(clientToUse, norm, {
      waitForConfirmation: true,
      timeoutMs: 30000,
      userAddress: ctx.userAddress,
      useSession: useSessionFlow,
      sendSessionTx: useSessionFlow ? ctx.sendSessionTx : undefined,
    });

    // Update idempotency status
    updateTransactionStatus(promptId, "completed", txHash);

    console.log("✅ Transaction executed successfully:", txHash);

    // Phase 7: Generate response
    const amountEth = formatEther(norm.amountWei);
    const message = formatSuccessMessage(amountEth, norm.chainId, txHash);
    const explorerLink = generateExplorerLink(norm.chainId, txHash);

    return {
      success: true,
      txHash,
      message,
      explorerLink,
      norm,
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
  biconomyClient: any,
  userAddress: `0x${string}`,
  sessionContext?: {
    // sessionClient removed - using main biconomyClient for session transactions
    hasActiveSession: boolean;
    sendSessionTx?: (params: {
      to: string;
      value?: string;
      data?: string;
    }) => Promise<string>;
  },
): Promise<OrchestrationResponse> {
  return orchestrateTransaction(prompt, {
    userId,
    biconomyClient,
    // sessionClient removed - using main biconomyClient for session transactions
    userAddress,
    hasActiveSession: sessionContext?.hasActiveSession || false,
    sendSessionTx: sessionContext?.sendSessionTx,
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
