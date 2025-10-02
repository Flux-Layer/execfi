// Feedback effects for success and failure states
import type { StepDef } from "../state/types";
import { formatOrchestrationError } from "@/lib/orchestrator";

export const successFx: StepDef["onEnter"] = (ctx, core, dispatch, signal) => {
  if (signal.aborted) return;

  const flowName = ctx.name || "Transaction";
  const message = ctx.exec?.hash
    ? `✅ ${flowName} successful — ${ctx.exec.hash}`
    : `✅ ${flowName} completed successfully`;

  console.log("✅ Flow completed successfully");

  // Add success toast
  dispatch({
    type: "OVERLAY.PUSH",
    overlay: {
      kind: "toast",
      level: "info",
      text: message,
      ttlMs: 6000,
    },
  });

  // Add final success message to chat
  dispatch({
    type: "CHAT.ADD",
    message: {
      role: "assistant",
      content: "🎉 Transaction completed successfully!",
      timestamp: Date.now(),
    },
  });

  // Complete the flow and return to IDLE with proper completion message
  setTimeout(() => {
    // Complete the flow - this will add the completion message via reducer
    dispatch({
      type: "FLOW.COMPLETE"
    });
  }, 1500); // Small delay to let success messages appear first
};

export const failureFx: StepDef["onEnter"] = (ctx, core, dispatch, signal) => {
  if (signal.aborted) return;

  const error = ctx.error;
  let errorMessage = "❌ Transaction failed";

  if (error) {
    // Use orchestrator error formatting if available
    try {
      const formattedError = formatOrchestrationError({
        name: "OrchestrationError",
        message: error.message,
        code: error.code,
        phase: error.phase as any,
      } as any);
      errorMessage = formattedError;
    } catch {
      // Fallback to basic error message
      errorMessage = `❌ ${error.message || "Transaction failed"}`;
    }
  }

  console.error("❌ Flow failed:", error);

  // Add error toast (skip for auth errors as they show inline message)
  if (error?.code !== "AUTH_REQUIRED") {
    dispatch({
      type: "OVERLAY.PUSH",
      overlay: {
        kind: "toast",
        level: "error",
        text: errorMessage,
        ttlMs: 8000, // Keep error messages longer
      },
    });
  }

  // Add error message to chat (skip for auth errors as they're already handled in reducer)
  if (error?.code !== "AUTH_REQUIRED") {
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: errorMessage,
        timestamp: Date.now(),
      },
    });
  }

  // Provide helpful suggestions based on error type
  const suggestions = getErrorSuggestions(error?.code);
  if (suggestions.length > 0) {
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: `💡 ${suggestions.join(" ")}`,
        timestamp: Date.now(),
      },
    });
  }

  // Complete the flow after failure (return to IDLE with failure message)
  setTimeout(() => {
    dispatch({
      type: "FLOW.FAIL"
    });
  }, 2000); // Give time for error messages to appear
};

function getErrorSuggestions(errorCode?: string): string[] {
  const suggestions: string[] = [];

  switch (errorCode) {
    case "INSUFFICIENT_FUNDS":
      suggestions.push("Please add more ETH to your account or try a smaller amount.");
      break;

    case "INVALID_ADDRESS":
    case "ADDRESS_INVALID":
      suggestions.push("Please check the recipient address and try again.");
      break;

    case "CHAIN_UNSUPPORTED":
      suggestions.push("This chain is not yet supported. Try using Base instead.");
      break;

    case "SIMULATION_FAILED":
      suggestions.push("The transaction simulation failed. Please check your inputs and try again.");
      break;

    case "USER_REJECTED":
      suggestions.push("Transaction was cancelled. You can try again when ready.");
      break;

    case "NETWORK_ERROR":
      suggestions.push("Network error occurred. Please check your connection and try again.");
      break;

    case "DUPLICATE_TRANSACTION":
      suggestions.push("This transaction was already submitted recently.");
      break;

    case "AUTH_REQUIRED":
      suggestions.push("Click the profile icon or type 'login' to authenticate and unlock transaction features.");
      break;

    default:
      if (errorCode?.includes("GAS")) {
        suggestions.push("Gas-related error. Please try again or adjust the transaction amount.");
      } else {
        suggestions.push("You can try again or contact support if the issue persists.");
      }
      break;
  }

  return suggestions;
}

// Helper for creating retry actions
export const retryActionFx: StepDef["onEnter"] = (ctx, core, dispatch, signal) => {
  if (signal.aborted) return;

  console.log("🔄 Retrying flow...");

  // Reset flow to parse step
  dispatch({ type: "FLOW.RETRY" });
};