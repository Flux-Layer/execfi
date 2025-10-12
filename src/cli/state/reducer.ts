// Pure reducer for HSM state transitions
import type { AppState, AppEvent, FlowContext } from "./types";
import { inferFlowName, parseSlashCommand, createAppError } from "./events";
import { trackTransaction } from "@/lib/policy/checker";
import { savePolicy, createDefaultPolicy } from "@/lib/policy/storage";

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
      policy: createDefaultPolicy("moderate"), // Initialize with default moderate policy
      defaultSlippage: 0.005, // Default 0.5% slippage
    },
    inputText: "",
    chatHistory: [],
    lastCommand: undefined,
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
      // Reset to a clean initial state while preserving core context.
      // Do not append any system message so the UI looks like first render.
      return {
        ...createInitialState(),
        core: state.core,
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
        return reducer(state, slashEvent);
      }

      // Regular input - start a flow if in IDLE or VIEW mode
      if (state.mode === "IDLE" || state.mode === "VIEW") {
        // Check for pending slippage override
        const slippage = state.core.pendingSlippage;
        
        return {
          ...state,
          mode: "FLOW",
          inputText: "",
          flow: {
            name: inferFlowName(text),
            step: "parse",
            raw: text,
            slippage, // Include pending slippage if set
          },
          core: {
            ...state.core,
            pendingSlippage: undefined, // Clear pending slippage after use
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
        // Map intent action to correct flow name
        let flowName = state.flow.name;
        if (event.intent.action === "bridge") {
          flowName = "bridge";
        } else if (event.intent.action === "bridge_swap") {
          flowName = "bridge-swap";
        } else if (event.intent.action === "swap") {
          flowName = "swap";
        } else if (event.intent.action === "transfer") {
          flowName = "transfer";
        }

        return {
          ...state,
          flow: {
            ...state.flow,
            name: flowName, // Update flow name based on actual detected action
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
      if (state.mode === "FLOW" && (state.flow?.step === "parse" || state.flow?.step === "normalize")) {
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
        const raw = state.flow.raw || "";

        // Detect intent type from raw input
        let reconstructedIntent: any;

        // Pattern detection order (most specific first):
        // 1. Bridge-swap: "swap X eth on lisk to usdc on base"
        // 2. Bridge: "swap X eth on lisk to base" or "bridge X eth from lisk to base"
        // 3. Same-chain swap: "swap X eth to usdc on lisk"

        const bridgeSwapPattern = raw.match(/swap\s+([\d.]+)\s+(\w+)\s+on\s+(\w+)\s+to\s+(\w+)\s+on\s+(\w+)/i);
        const unifiedBridgePattern = raw.match(/swap\s+([\d.]+)\s+(\w+)\s+on\s+(\w+)\s+to\s+(\w+)(?!\s+on)/i);
        // Legacy bridge pattern: supports both "from" and "on" for source chain
        const legacyBridgePattern = raw.match(/bridge\s+([\d.]+)\s+(\w+)(?:\s+(?:from|on)\s+(\w+))?(?:\s+to\s+(\w+))?/i);
        const swapPattern = raw.match(/swap\s+([\d.]+)\s+(\w+)\s+to\s+(\w+)(?:\s+on\s+(\w+))?/i);

        if (bridgeSwapPattern) {
          // Pattern: swap 0.00001 eth on lisk to usdc on base (bridge-swap)
          const amountMatch = bridgeSwapPattern[1];
          const fromTokenMatch = bridgeSwapPattern[2];
          const fromChainMatch = bridgeSwapPattern[3];
          const toTokenMatch = bridgeSwapPattern[4];
          const toChainMatch = bridgeSwapPattern[5];

          // Check if we already have selected tokens from previous selections
          const previousIntent = state.flow.intent as any;
          const previousFromToken = previousIntent?._selectedFromToken;
          const previousToToken = previousIntent?._selectedToToken;

          // Use sequential selection logic
          const isSelectingFromToken = !previousFromToken;
          let selectedFromToken: any;
          let selectedToToken: any;

          if (isSelectingFromToken) {
            selectedFromToken = selectedToken;
            selectedToToken = previousToToken;
            console.log("🎯 [TOKEN.SELECT] Bridge-swap first selection → fromToken:", selectedToken.symbol);
          } else {
            selectedFromToken = previousFromToken;
            selectedToToken = selectedToken;
            console.log("🎯 [TOKEN.SELECT] Bridge-swap second selection → toToken:", selectedToken.symbol);
          }

          reconstructedIntent = {
            action: "bridge_swap" as const,
            fromChain: fromChainMatch,
            toChain: toChainMatch,
            fromToken: selectedFromToken ? selectedFromToken.symbol : fromTokenMatch,
            toToken: selectedToToken ? selectedToToken.symbol : toTokenMatch,
            amount: amountMatch,
            _selectedFromToken: selectedFromToken,
            _selectedToToken: selectedToToken,
          };
        } else if (unifiedBridgePattern) {
          // Pattern: swap 0.00001 eth on lisk to base (unified bridge)
          const amountMatch = unifiedBridgePattern[1];
          const tokenMatch = unifiedBridgePattern[2];
          const fromChainMatch = unifiedBridgePattern[3];
          const toChainMatch = unifiedBridgePattern[4];

          reconstructedIntent = {
            action: "bridge" as const,
            fromChain: fromChainMatch,
            toChain: toChainMatch,
            token: selectedToken ? selectedToken.symbol : tokenMatch,
            amount: amountMatch,
            _selectedToken: selectedToken,
          };
        } else if (legacyBridgePattern) {
          // Pattern: bridge 0.00001 eth from lisk to base (legacy bridge)
          const amountMatch = legacyBridgePattern[1];
          const tokenMatch = legacyBridgePattern[2];
          const fromChainMatch = legacyBridgePattern[3];
          const toChainMatch = legacyBridgePattern[4];

          reconstructedIntent = {
            action: "bridge" as const,
            fromChain: fromChainMatch || toChainMatch,
            toChain: toChainMatch || fromChainMatch,
            token: selectedToken ? selectedToken.symbol : tokenMatch,
            amount: amountMatch,
            _selectedToken: selectedToken,
          };
        } else if (swapPattern) {
          // Pattern: swap 0.00001 eth to usdc on lisk (same-chain swap)
          const amountMatch = swapPattern[1];
          const fromTokenMatch = swapPattern[2];
          const toTokenMatch = swapPattern[3];
          const chainMatch = swapPattern[4];

          // Check if we already have selected tokens
          const previousIntent = state.flow.intent as any;
          const previousFromToken = previousIntent?._selectedFromToken;
          const previousToToken = previousIntent?._selectedToToken;

          // Use sequential selection logic
          const isSelectingFromToken = !previousFromToken;
          let selectedFromToken: any;
          let selectedToToken: any;

          if (isSelectingFromToken) {
            selectedFromToken = selectedToken;
            selectedToToken = previousToToken;
            console.log("🎯 [TOKEN.SELECT] Swap first selection → fromToken:", selectedToken.symbol);
          } else {
            selectedFromToken = previousFromToken;
            selectedToToken = selectedToken;
            console.log("🎯 [TOKEN.SELECT] Swap second selection → toToken:", selectedToken.symbol);
          }

          reconstructedIntent = {
            action: "swap" as const,
            fromChain: chainMatch || selectedToken.chainId,
            toChain: chainMatch || selectedToken.chainId,
            fromToken: selectedFromToken ? selectedFromToken.symbol : fromTokenMatch,
            toToken: selectedToToken ? selectedToToken.symbol : toTokenMatch,
            amount: amountMatch,
            _selectedFromToken: selectedFromToken,
            _selectedToToken: selectedToToken,
          };
        } else {
          // Transfer intent - parse "send/transfer X token to address"
          const recipientMatch = raw.match(/to\s+(0x[a-fA-F0-9]{40}|[\w\d.-]+\.eth)/i);
          const amountMatch = raw.match(/(?:send|transfer)\s+([\d.]+)/i); // Support both "send" and "transfer"

          if (!recipientMatch || !amountMatch) {
            console.error("Failed to parse transfer intent:", { raw, recipientMatch, amountMatch });
            return {
              ...state,
              flow: {
                ...state.flow,
                step: "failure",
                error: {
                  code: "INTENT_RECONSTRUCTION_FAILED",
                  message: "Failed to reconstruct transfer intent with selected token",
                  phase: "normalize",
                },
              },
            };
          }

          const isNativeToken = selectedToken.address === "0x0000000000000000000000000000000000000000";
          reconstructedIntent = {
            action: "transfer" as const,
            chain: selectedToken.chainId,
            token: isNativeToken ? {
              type: "native" as const,
              symbol: selectedToken.symbol,
              decimals: 18,
            } : {
              type: "erc20" as const,
              symbol: selectedToken.symbol,
              address: selectedToken.address,
              decimals: 18, // Default, will be resolved during normalization
            },
            amount: amountMatch[1],
            recipient: recipientMatch[1],
            _selectedToken: selectedToken,
          };
        }

        console.log("🔄 TOKEN.SELECT - Reconstructed intent:", reconstructedIntent);
        console.log("🔄 TOKEN.SELECT - Has _selectedFromToken:", !!(reconstructedIntent as any)._selectedFromToken);
        console.log("🔄 TOKEN.SELECT - Has _selectedToToken:", !!(reconstructedIntent as any)._selectedToToken);

        // Map intent action to correct flow name (same logic as INTENT.OK)
        let flowName = state.flow.name;
        if (reconstructedIntent.action === "bridge") {
          flowName = "bridge";
        } else if (reconstructedIntent.action === "bridge_swap") {
          flowName = "bridge-swap";
        } else if (reconstructedIntent.action === "swap") {
          flowName = "swap";
        } else if (reconstructedIntent.action === "transfer") {
          flowName = "transfer";
        }

        // Return new state with updated intent and force step to "normalize"
        // Note: Even if step was already "normalize", updating the intent should be enough
        return {
          ...state,
          flow: {
            ...state.flow,
            name: flowName, // Update flow name based on reconstructed action
            selectedTokenIndex: event.index,
            tokenSelection: undefined, // Clear selection state
            intent: reconstructedIntent, // Set the reconstructed intent with both tokens
            step: "normalize", // Set to normalize (will re-run if intent changed)
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
      console.log("🔍 VALIDATE.OK received - State check:", {
        mode: state.mode,
        flowStep: state.flow?.step,
        flowName: state.flow?.name,
      });
      if (state.mode === "FLOW" && state.flow?.step === "validate") {
        console.log("✅ VALIDATE.OK conditions met, transitioning to plan step");
        return {
          ...state,
          flow: {
            ...state.flow,
            step: "plan",
            error: undefined,
          },
        };
      }
      console.log("❌ VALIDATE.OK conditions NOT met, no transition");
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
      console.log("🔍 SIM.OK received - State check:", {
        mode: state.mode,
        flowStep: state.flow?.step,
        hasFlow: !!state.flow,
      });
      if (state.mode === "FLOW" && state.flow?.step === "simulate") {
        console.log("✅ SIM.OK conditions met, transitioning...");
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
        console.log("🔍 CONFIRM.YES - Flow context before transition:", {
          hasPlan: !!state.flow.plan,
          planKeys: state.flow.plan ? Object.keys(state.flow.plan) : [],
          hasRoute: !!state.flow.plan?.route,
        });
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
        // Use AUTH.CANCEL to handle the cancellation message
        return reducer(state, { type: "AUTH.CANCEL" });
      }

      // Handle FLOW mode cancellation
      const shouldShowMessage = !event.silent;

      return {
        ...state,
        mode: "IDLE",
        flow: undefined,
        viewStack: [], // Clear view stack when cancelling flow
        chatHistory: shouldShowMessage ? [
          ...state.chatHistory,
          {
            role: "assistant",
            content: state.flow ? "Flow cancelled." : "Returned to main terminal.",
            timestamp: Date.now(),
          },
        ] : state.chatHistory,
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

        // Don't show completion message if this was triggered by a CLI command
        const isCommandExecution = state.lastCommand &&
          Date.now() - state.lastCommand.timestamp < 1000; // Within 1 second of command

        if (isCommandExecution) {
          // Silent completion for commands
          return {
            ...state,
            mode: "IDLE",
            flow: undefined,
            viewStack: [], // Clear view stack when completing flow
          };
        }

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

    case "AUTH.SUCCESS":
      return {
        ...state,
        mode: "IDLE",
        inputText: "",
        chatHistory: [
          ...state.chatHistory,
          {
            role: "assistant",
            content: "✅ Successfully signed in! You can now execute transactions.",
            timestamp: Date.now(),
          },
        ],
      };

    case "AUTH.CANCEL":
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

    case "AUTH.LOGOUT":
      // Only allow logout if user has a userId (is authenticated)
      if (!state.core.userId) {
        return {
          ...state,
          inputText: "",
          chatHistory: [
            ...state.chatHistory,
            {
              role: "assistant",
              content: "❌ You are not signed in. Use /login to sign in first.",
              timestamp: Date.now(),
            },
          ],
        };
      }

      return {
        ...state,
        mode: "IDLE",
        inputText: "",
        chatHistory: [
          ...state.chatHistory,
          {
            role: "assistant",
            content: "🔓 Signing out...",
            timestamp: Date.now(),
          },
        ],
      };

    case "COMMAND.EXECUTE": {
      // Commands should not create flows - they execute immediately
      return {
        ...state,
        mode: "IDLE", // Keep in IDLE mode
        inputText: "",
        flow: undefined, // Clear any existing flow
        lastCommand: {
          name: event.command,
          timestamp: Date.now(),
          result: event,
        },
      };
    }

    case "BALANCE.FETCH":
      // This triggers a balance fetch effect - state change handled by effect result
      return state;

    case "TERMINAL.CLEAR":
      return {
        ...state,
        chatHistory: [], // Clear chat history
        overlays: [],   // Clear overlays
        flow: undefined, // Clear any active flow
        mode: "IDLE",    // Return to idle
      };

    case "CHAIN.UPDATE":
      return {
        ...state,
        core: {
          ...state.core,
          chainId: event.chainId,
        },
      };

    case "ACCOUNT_MODE.UPDATE":
      // Update account mode and persist to localStorage
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("execfi_account_mode", event.accountMode);
        } catch (error) {
          console.warn("Failed to save account mode to localStorage:", error);
        }
      }
      return {
        ...state,
        core: {
          ...state.core,
          accountMode: event.accountMode,
        },
      };

    case "POLICY.UPDATE":
      return {
        ...state,
        core: {
          ...state.core,
          policy: event.policy,
        },
      };

    case "POLICY.TX_TRACKED": {
      // Track transaction in policy
      const updatedPolicy = trackTransaction(state.core.policy, event.amountETH);
      savePolicy(updatedPolicy);

      return {
        ...state,
        core: {
          ...state.core,
          policy: updatedPolicy,
        },
      };
    }

    case "POLICY.RESET":
      // Handled by policy commands, no state change needed here
      return state;

    case "POLICY.VIOLATION":
      // Policy violations are logged, no state change needed
      console.warn("Policy violations:", event.violations);
      return state;

    case "SLIPPAGE.SET_PENDING":
      return {
        ...state,
        core: {
          ...state.core,
          pendingSlippage: event.slippage,
        },
      };

    default:
      return state;
  }
}
