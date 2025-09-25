// Pure reducer for HSM state transitions
import type { AppState, AppEvent, FlowContext } from "./types";
import { inferFlowName, parseSlashCommand, createAppError } from "./events";

/**
 * Initial state factory
 */
export function createInitialState(): AppState {
  return {
    mode: "IDLE",
    flow: undefined,
    viewStack: [],
    overlays: [],
    core: {
      userId: "",
      chainId: 8453, // Base mainnet
      idempotency: new Map(),
    },
    inputText: "",
    chatHistory: [],
  };
}

/**
 * Main reducer - handles all state transitions
 */
export function reducer(state: AppState, event: AppEvent): AppState {
  switch (event.type) {
    case "APP.INIT":
      return {
        ...state,
        core: { ...state.core, ...event.coreContext },
      };

    case "APP.RESET":
      return {
        ...createInitialState(),
        core: state.core, // Keep core context (auth, wallet, etc.)
        chatHistory: [
          ...state.chatHistory,
          {
            role: "assistant",
            content: "🔄 Terminal reset. All flows cleared.",
            timestamp: Date.now(),
          },
        ],
      };

    case "INPUT.CHANGE":
      return {
        ...state,
        inputText: event.text,
      };

    case "INPUT.SUBMIT": {
      const text = event.text.trim();
      if (!text) return state;

      // Check for slash commands first
      const slashEvent = parseSlashCommand(text);
      if (slashEvent) {
        // Clear input and add to chat
        const nextState = {
          ...state,
          inputText: "",
          chatHistory: [
            ...state.chatHistory,
            {
              role: "user" as const,
              content: text,
              timestamp: Date.now(),
            },
          ],
        };
        // Recursively handle the slash command
        return reducer(nextState, slashEvent);
      }

      // Regular input - start a flow if in IDLE or VIEW mode
      if (state.mode === "IDLE" || state.mode === "VIEW") {
        return {
          ...state,
          mode: "FLOW",
          inputText: "",
          flow: {
            name: inferFlowName(text),
            step: "parse",
            raw: text,
          },
          viewStack: [], // Clear view stack when starting a flow
          chatHistory: [
            ...state.chatHistory,
            {
              role: "user",
              content: text,
              timestamp: Date.now(),
            },
          ],
        };
      }

      // Handle input during clarification
      if (state.mode === "FLOW" && state.flow?.step === "clarify") {
        // Update the raw input with clarification response and restart parsing
        const updatedRaw = state.flow.raw ? `${state.flow.raw} ${text}` : text;
        return reducer(
          {
            ...state,
            inputText: "",
            chatHistory: [
              ...state.chatHistory,
              {
                role: "user",
                content: text,
                timestamp: Date.now(),
              },
            ],
            flow: {
              ...state.flow,
              raw: updatedRaw,
              step: "parse", // Restart parsing with updated context
              error: undefined,
            },
          },
          { type: "APP.TICK" } // Trigger effects runner
        );
      }

      // Handle input during confirmation
      if (state.mode === "FLOW" && state.flow?.step === "confirm") {
        const confirmResponse = text.toLowerCase();
        const isYes = !text || confirmResponse === "yes" || confirmResponse === "y" || confirmResponse === "ok" || confirmResponse === "confirm";
        const isNo = confirmResponse === "no" || confirmResponse === "n" || confirmResponse === "cancel" || confirmResponse === "abort";

        if (isYes) {
          return reducer(
            {
              ...state,
              inputText: "",
              chatHistory: [
                ...state.chatHistory,
                {
                  role: "user",
                  content: text || "✅ Confirmed",
                  timestamp: Date.now(),
                },
              ],
            },
            { type: "CONFIRM.YES" }
          );
        } else if (isNo) {
          return reducer(
            {
              ...state,
              inputText: "",
              chatHistory: [
                ...state.chatHistory,
                {
                  role: "user",
                  content: "❌ Cancelled",
                  timestamp: Date.now(),
                },
              ],
            },
            { type: "CONFIRM.NO" }
          );
        } else {
          // Invalid confirmation response
          return {
            ...state,
            inputText: "",
            chatHistory: [
              ...state.chatHistory,
              {
                role: "user",
                content: text,
                timestamp: Date.now(),
              },
              {
                role: "assistant",
                content: "⚠️ Please type 'yes', 'no', press Enter to confirm, or Esc to cancel",
                timestamp: Date.now(),
              },
            ],
          };
        }
      }

      // Handle input during token selection
      if (state.flow?.tokenSelection) {
        const index = parseInt(text) - 1; // Convert 1-based to 0-based
        if (
          !isNaN(index) &&
          index >= 0 &&
          index < state.flow.tokenSelection.tokens.length
        ) {
          return reducer(
            {
              ...state,
              inputText: "",
              chatHistory: [
                ...state.chatHistory,
                {
                  role: "user",
                  content: text,
                  timestamp: Date.now(),
                },
              ],
            },
            { type: "TOKEN.SELECT", index }
          );
        } else {
          // Invalid token selection
          return {
            ...state,
            inputText: "",
            chatHistory: [
              ...state.chatHistory,
              {
                role: "user",
                content: text,
                timestamp: Date.now(),
              },
              {
                role: "assistant",
                content: `⚠️ Please enter a number between 1 and ${state.flow.tokenSelection.tokens.length}`,
                timestamp: Date.now(),
              },
            ],
          };
        }
      }

      return state;
    }

    case "CHAT.ADD":
      return {
        ...state,
        chatHistory: [...state.chatHistory, event.message],
      };

    // Flow state transitions
    case "INTENT.OK":
      if (state.mode === "FLOW" && state.flow?.step === "parse") {
        return {
          ...state,
          flow: {
            ...state.flow,
            step: "normalize",
            intent: event.intent,
            error: undefined,
          },
        };
      }
      return state;

    case "INTENT.CLARIFY":
      if (state.mode === "FLOW" && state.flow?.step === "parse") {
        return {
          ...state,
          flow: {
            ...state.flow,
            step: "clarify",
            error: createAppError("MISSING_FIELDS", event.prompt, event.missing),
          },
          chatHistory: [
            ...state.chatHistory,
            {
              role: "assistant",
              content: {
                type: "clarification",
                question: event.prompt,
                missing: event.missing,
              },
              timestamp: Date.now(),
            },
          ],
        };
      }
      return state;

    case "INTENT.TOKEN_SELECTION":
      if (state.mode === "FLOW" && state.flow?.step === "parse") {
        return {
          ...state,
          flow: {
            ...state.flow,
            tokenSelection: event.tokenSelection,
          },
          chatHistory: [
            ...state.chatHistory,
            {
              role: "assistant",
              content: {
                type: "token-table",
                message: event.tokenSelection?.message,
                tokens: event.tokenSelection?.tokens,
              },
              timestamp: Date.now(),
            },
            {
              role: "assistant",
              content: "Please enter the number of the token you want to use:",
              timestamp: Date.now(),
            },
          ],
        };
      }
      return state;

    case "TOKEN.SELECT":
      if (state.mode === "FLOW" && state.flow?.tokenSelection) {
        const selectedToken = state.flow.tokenSelection.tokens[event.index];
        return {
          ...state,
          flow: {
            ...state.flow,
            selectedTokenIndex: event.index,
            tokenSelection: undefined, // Clear selection state
            step: "normalize", // Continue to normalize
          },
          chatHistory: [
            ...state.chatHistory,
            {
              role: "assistant",
              content: `✅ Selected: ${selectedToken.name} (${selectedToken.symbol})`,
              timestamp: Date.now(),
            },
          ],
        };
      }
      return state;

    case "NORMALIZE.OK":
      if (state.mode === "FLOW" && state.flow?.step === "normalize") {
        return {
          ...state,
          flow: {
            ...state.flow,
            step: "validate",
            norm: event.norm,
            error: undefined,
          },
        };
      }
      return state;

    case "NORMALIZE.FAIL":
      if (state.mode === "FLOW" && state.flow?.step === "normalize") {
        return {
          ...state,
          flow: {
            ...state.flow,
            step: "failure",
            error: event.error,
          },
        };
      }
      return state;

    case "VALIDATE.OK":
      if (state.mode === "FLOW" && state.flow?.step === "validate") {
        return {
          ...state,
          flow: {
            ...state.flow,
            step: "plan",
            error: undefined,
          },
        };
      }
      return state;

    case "VALIDATE.FAIL":
      if (state.mode === "FLOW" && state.flow?.step === "validate") {
        // For auth errors, show message immediately in chat
        const isAuthError = event.error.code === "AUTH_REQUIRED";
        const nextState = {
          ...state,
          flow: {
            ...state.flow,
            step: "failure" as const,
            error: event.error,
          },
        };

        if (isAuthError) {
          return {
            ...nextState,
            chatHistory: [
              ...state.chatHistory,
              {
                role: "assistant" as const,
                content: `🔒 ${event.error.message}`,
                timestamp: Date.now(),
              },
            ],
          };
        }

        return nextState;
      }
      return state;

    case "PLAN.OK":
      if (state.mode === "FLOW" && state.flow?.step === "plan") {
        return {
          ...state,
          flow: {
            ...state.flow,
            step: "simulate",
            plan: event.plan,
            error: undefined,
          },
        };
      }
      return state;

    case "PLAN.FAIL":
      if (state.mode === "FLOW" && state.flow?.step === "plan") {
        return {
          ...state,
          flow: {
            ...state.flow,
            step: "failure",
            error: event.error,
          },
        };
      }
      return state;

    case "SIM.OK":
      if (state.mode === "FLOW" && state.flow?.step === "simulate") {
        // Check if original prompt contains auto-confirmation keywords
        const autoConfirmKeywords = [
          "auto", "automatically", "skip confirmation", "force", "proceed",
          "confirm", "yes", "execute now", "immediately", "without asking",
          "no confirmation", "bypass", "direct", "instant", "now", "right now",
          "asap", "go ahead", "send it", "do it", "just do it", "skip confirm",
          "auto confirm", "auto execute", "execute immediately", "quick",
          "fast", "urgent", "emergency", "straight away", "right away"
        ];

        const shouldAutoConfirm = state.flow.raw &&
          autoConfirmKeywords.some(keyword =>
            state.flow!.raw!.toLowerCase().includes(keyword.toLowerCase())
          );

        if (shouldAutoConfirm) {
          // Auto-confirm and move directly to execute step
          return {
            ...state,
            flow: {
              ...state.flow,
              step: "execute",
              sim: event.sim,
              error: undefined,
            },
            chatHistory: [
              ...state.chatHistory,
              {
                role: "assistant",
                content: "🤖 Auto-confirming transaction (detected confirmation keyword)",
                timestamp: Date.now(),
              },
            ],
          };
        } else {
          // Regular confirmation flow
          return {
            ...state,
            flow: {
              ...state.flow,
              step: "confirm",
              sim: event.sim,
              error: undefined,
            },
          };
        }
      }
      return state;

    case "SIM.FAIL":
      if (state.mode === "FLOW" && state.flow?.step === "simulate") {
        return {
          ...state,
          flow: {
            ...state.flow,
            step: "failure",
            error: event.error,
          },
        };
      }
      return state;

    case "CONFIRM.YES":
      if (state.mode === "FLOW" && state.flow?.step === "confirm") {
        return {
          ...state,
          flow: {
            ...state.flow,
            step: "execute",
            error: undefined,
          },
        };
      }
      return state;

    case "CONFIRM.NO":
      if (state.mode === "FLOW" && state.flow?.step === "confirm") {
        return {
          ...state,
          mode: "IDLE",
          flow: undefined,
          chatHistory: [
            ...state.chatHistory,
            {
              role: "assistant",
              content: "Transaction cancelled.",
              timestamp: Date.now(),
            },
          ],
        };
      }
      return state;

    case "EXEC.OK":
      if (state.mode === "FLOW" && state.flow?.step === "execute") {
        return {
          ...state,
          flow: {
            ...state.flow,
            step: "monitor",
            exec: {
              hash: event.hash,
              explorerUrl: event.explorerUrl,
              submittedAt: Date.now(),
            },
            error: undefined,
          },
        };
      }
      return state;

    case "EXEC.FAIL":
      if (state.mode === "FLOW" && state.flow?.step === "execute") {
        return {
          ...state,
          flow: {
            ...state.flow,
            step: "failure",
            error: event.error,
          },
        };
      }
      return state;

    case "MONITOR.OK":
      if (state.mode === "FLOW" && state.flow?.step === "monitor") {
        return {
          ...state,
          flow: {
            ...state.flow,
            step: "success",
            error: undefined,
          },
        };
      }
      return state;

    case "MONITOR.FAIL":
      if (state.mode === "FLOW" && state.flow?.step === "monitor") {
        return {
          ...state,
          flow: {
            ...state.flow,
            step: "failure",
            error: event.error,
          },
        };
      }
      return state;

    // Flow control
    case "FLOW.CANCEL":
      // Handle AUTH mode cancellation
      if (state.mode === "AUTH") {
        return {
          ...state,
          mode: "IDLE",
          inputText: "",
          chatHistory: [
            ...state.chatHistory,
            {
              role: "assistant",
              content: "Authentication cancelled. You can try /login again anytime.",
              timestamp: Date.now(),
            },
          ],
        };
      }

      // Handle FLOW mode cancellation
      return {
        ...state,
        mode: "IDLE",
        flow: undefined,
        viewStack: [], // Clear view stack when cancelling flow
        chatHistory: [
          ...state.chatHistory,
          {
            role: "assistant",
            content: state.flow ? "Flow cancelled." : "Returned to main terminal.",
            timestamp: Date.now(),
          },
        ],
      };

    case "FLOW.RETRY":
      if (state.flow) {
        return {
          ...state,
          flow: {
            ...state.flow,
            step: "parse", // Restart from parse
            error: undefined,
            intent: undefined,
            norm: undefined,
            plan: undefined,
            sim: undefined,
            exec: undefined,
          },
        };
      }
      return state;

    case "FLOW.BACK":
      // TODO: Implement smart back navigation based on current step
      return state;

    case "FLOW.COMPLETE":
      if (state.flow) {
        const flowName = state.flow.name || "transaction";
        return {
          ...state,
          mode: "IDLE",
          flow: undefined,
          viewStack: [], // Clear view stack when completing flow
          chatHistory: [
            ...state.chatHistory,
            {
              role: "assistant",
              content: `🎉 ${flowName.charAt(0).toUpperCase() + flowName.slice(1)} flow completed successfully!`,
              timestamp: Date.now(),
            },
          ],
        };
      }
      return state;

    case "FLOW.FAIL":
      if (state.flow) {
        const flowName = state.flow.name || "transaction";
        return {
          ...state,
          mode: "IDLE",
          flow: undefined,
          viewStack: [], // Clear view stack when flow fails
          chatHistory: [
            ...state.chatHistory,
            {
              role: "assistant",
              content: `❌ ${flowName.charAt(0).toUpperCase() + flowName.slice(1)} flow failed. You can try again or use /reset if needed.`,
              timestamp: Date.now(),
            },
          ],
        };
      }
      return state;

    // Navigation
    case "NAV.VIEW.PUSH":
      return {
        ...state,
        mode: "VIEW",
        viewStack: [...state.viewStack, event.page],
      };

    case "NAV.VIEW.POP":
      const newStack = state.viewStack.slice(0, -1);
      return {
        ...state,
        mode: newStack.length > 0 ? "VIEW" : "IDLE",
        viewStack: newStack,
      };

    // Overlays
    case "OVERLAY.PUSH":
      return {
        ...state,
        overlays: [...state.overlays, event.overlay],
      };

    case "OVERLAY.POP": {
      const filtered = event.id
        ? state.overlays.filter((o) => o.kind !== "toast" || (o as any).id !== event.id)
        : state.overlays.slice(0, -1);
      return {
        ...state,
        overlays: filtered,
      };
    }

    case "APP.TICK":
      // Handle timed overlays (toasts)
      const now = Date.now();
      const filteredOverlays = state.overlays.filter((overlay) => {
        if (overlay.kind === "toast") {
          const createdAt = (overlay as any).createdAt || now;
          return now - createdAt < overlay.ttlMs;
        }
        return true;
      });

      if (filteredOverlays.length !== state.overlays.length) {
        return {
          ...state,
          overlays: filteredOverlays,
        };
      }
      return state;

    case "AUTH.START":
      return {
        ...state,
        mode: "AUTH",
        inputText: "",
        chatHistory: [
          ...state.chatHistory,
          {
            role: "assistant",
            content: "🔐 Starting authentication flow. Please enter your email to sign in.",
            timestamp: Date.now(),
          },
        ],
      };

    case "AUTH.STOP":
      return {
        ...state,
        mode: "IDLE",
        inputText: "",
        chatHistory: [
          ...state.chatHistory,
          {
            role: "assistant",
            content: "Authentication cancelled. You can try /login again anytime.",
            timestamp: Date.now(),
          },
        ],
      };

    default:
      return state;
  }
}