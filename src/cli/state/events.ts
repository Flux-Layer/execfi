// Event utilities and helpers for HSM
import type { AppEvent, FlowName } from "./types";

/**
 * Infer flow type from input text
 * Simple heuristics for now - can be enhanced with better NLP
 */
export function inferFlowName(text: string): FlowName {
  const lower = text.toLowerCase();

  // Transfer indicators
  if (lower.includes("send") || lower.includes("transfer") || lower.match(/\d+\s*(eth|ether)/)) {
    return "transfer";
  }

  // Swap indicators
  if (lower.includes("swap") || lower.includes("exchange")) {
    return "swap";
  }

  // Bridge indicators
  if (lower.includes("bridge") || lower.includes("cross-chain")) {
    if (lower.includes("swap")) {
      return "bridge-swap";
    }
    return "bridge";
  }

  // Default to transfer for simple commands
  return "transfer";
}

/**
 * Parse slash commands into events
 */
export function parseSlashCommand(text: string): AppEvent | null {
  if (!text.startsWith("/")) return null;

  const [cmd, ...args] = text.slice(1).split(" ");

  switch (cmd.toLowerCase()) {
    case "help":
      return { type: "NAV.VIEW.PUSH", page: { kind: "help" } };

    case "login":
    case "signin":
    case "auth":
      return { type: "AUTH.START" };

    case "logout":
    case "signout":
      return { type: "AUTH.LOGOUT" };

    case "settings":
      return { type: "NAV.VIEW.PUSH", page: { kind: "settings" } };

    case "balances":
      return { type: "NAV.VIEW.PUSH", page: { kind: "balances" } };

    case "tx":
      if (args[0]) {
        return { type: "NAV.VIEW.PUSH", page: { kind: "tx-detail", txHash: args[0] } };
      }
      break;

    case "cancel":
      // In AUTH mode, cancel means exit auth flow
      // In FLOW mode, cancel means cancel flow
      // Context will be determined by the reducer
      return { type: "FLOW.CANCEL" };

    case "retry":
      return { type: "FLOW.RETRY" };

    case "back":
      return { type: "FLOW.BACK" };

    case "exit":
    case "close":
      return { type: "NAV.VIEW.POP" };

    case "home":
    case "main":
      // Clear all views and return to IDLE
      return { type: "FLOW.CANCEL" };

    case "reset":
    case "restart":
      // Emergency reset - clear everything and return to IDLE
      return { type: "APP.RESET" };

    case "chain":
      // TODO: Implement chain switching
      // For now, just show a toast
      return {
        type: "OVERLAY.PUSH",
        overlay: {
          kind: "toast",
          level: "info",
          text: `Chain switching not yet implemented`,
          ttlMs: 3000,
        },
      };
  }

  return null;
}

/**
 * Create standardized app error
 */
export function createAppError(
  code: string,
  message: string,
  detail?: unknown,
  phase?: string
) {
  return {
    code,
    message,
    detail,
    phase,
  };
}

/**
 * Event type guards
 */
export const isFlowEvent = (event: AppEvent): event is Extract<AppEvent, { type: `${string}.${string}` }> => {
  return event.type.includes(".");
};

export const isIntentEvent = (event: AppEvent): event is Extract<AppEvent, { type: `INTENT.${string}` }> => {
  return event.type.startsWith("INTENT.");
};

export const isFlowControlEvent = (event: AppEvent): event is Extract<AppEvent, { type: `FLOW.${string}` }> => {
  return event.type.startsWith("FLOW.");
};