// Intent parsing effects using existing orchestrator logic
import type { StepDef, Dispatch } from "../state/types";
import {
  parseIntent,
  isIntentSuccess,
  isIntentClarify,
  isIntentChat,
  isIntentTokenSelection,
} from "@/lib/ai";
import { routeCommand, isCommand, suggestCommands } from "../commands/registry";

export const parseIntentFx: StepDef["onEnter"] = async (
  ctx,
  core,
  dispatch,
  signal,
) => {
  if (!ctx.raw) {
    dispatch({
      type: "INTENT.CLARIFY",
      prompt: "Please provide a transaction command",
      missing: ["action"],
    });
    return;
  }

  const input = ctx.raw.trim();

  // Check if input is a command (starts with /)
  if (isCommand(input)) {
    console.log("🔄 Processing command:", input);

    const command = routeCommand(input);
    if (command) {
      try {
        const parseResult = command.parse(input);
        if (parseResult.ok) {
          // Execute command directly (handle both sync and async)
          const result = command.run(parseResult.args, core, dispatch);

          // If command returns a promise, handle it
          if (result instanceof Promise) {
            result.catch((error) => {
              console.error("Async command error:", error);
              dispatch({
                type: "CHAT.ADD",
                message: {
                  role: "assistant",
                  content: `❌ Command error: ${error.message || "Unknown error"}`,
                  timestamp: Date.now(),
                },
              });
              dispatch({ type: "FLOW.COMPLETE" });
            });
          }

          // Update last command tracking
          dispatch({
            type: "COMMAND.EXECUTE",
            command: command.name,
            commandDef: command,
            args: parseResult.args,
          });

          // Commands handle their own lifecycle - don't auto-complete the flow
          // View commands like /help will transition to VIEW mode
          // Action commands like /clear will complete themselves
          return;
        } else {
          // Command parse error
          dispatch({
            type: "OVERLAY.PUSH",
            overlay: {
              kind: "toast",
              level: "error",
              text: parseResult.error,
              ttlMs: 3000,
            },
          });
          dispatch({ type: "FLOW.CANCEL" });
          return;
        }
      } catch (error: any) {
        console.error("Command execution error:", error);
        dispatch({
          type: "OVERLAY.PUSH",
          overlay: {
            kind: "toast",
            level: "error",
            text: `Command error: ${error.message || "Unknown error"}`,
            ttlMs: 3000,
          },
        });
        dispatch({ type: "FLOW.CANCEL" });
        return;
      }
    } else {
      // Unknown command - suggest alternatives
      const suggestions = suggestCommands(input);
      const suggestionText =
        suggestions.length > 0
          ? ` Did you mean: ${suggestions.join(", ")}?`
          : " Use /help to see available commands.";

      dispatch({
        type: "OVERLAY.PUSH",
        overlay: {
          kind: "toast",
          level: "warn",
          text: `Unknown command: ${input.split(" ")[0]}.${suggestionText}`,
          ttlMs: 4000,
        },
      });
      dispatch({ type: "FLOW.CANCEL" });
      return;
    }
  }

  // Not a command - proceed with natural language processing
  try {
    console.log("🔄 Parsing intent:", ctx.raw);

    const intentResult = await parseIntent(ctx.raw);

    console.log({ intentResult });

    if (signal.aborted) return;

    if (isIntentChat(intentResult)) {
      console.log("💬 Chat response:", intentResult.response);
      // For chat responses, add to chat history and return to idle
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: intentResult.response,
          timestamp: Date.now(),
        },
      });
      // Return to idle mode silently for chat responses
      dispatch({
        type: "FLOW.CANCEL", // This will show proper completion message
        silent: true, // Flag to suppress the cancellation message
      });
      return;
    }

    if (isIntentClarify(intentResult)) {
      dispatch({
        type: "INTENT.CLARIFY",
        prompt: intentResult.clarify,
        missing: intentResult.missing,
      });
      return;
    }

    if (isIntentTokenSelection(intentResult)) {
      console.log("🎯 Token selection needed, using enhanced resolver");

      // Extract the symbol from the original raw input based on command type
      let ambiguousSymbol = 'UNKNOWN';
      let targetChainId: number | undefined = undefined; // ✅ Start with undefined to prioritize user input

      // PRIORITY 1: Try to extract chain from raw input patterns
      // Try swap patterns first: "swap X eth to usdc on base"
      const swapMatch = ctx.raw.match(/swap\s+[\d.]+\s+(\w+)(?:\s+to\s+(\w+))?(?:\s+on\s+(\w+))?/i);
      if (swapMatch) {
        // For swaps, we need to determine if it's the fromToken or toToken that's ambiguous
        // Check both tokens - try fromToken first, then toToken
        const fromToken = swapMatch[1];
        const toToken = swapMatch[2];
        const chain = swapMatch[3];

        ambiguousSymbol = fromToken; // Default to fromToken

        // If chain is specified, resolve it
        if (chain) {
          try {
            const { resolveChain } = await import("@/lib/chains/registry");
            targetChainId = resolveChain(chain).id;
            console.log(`✅ Extracted chain from swap pattern: ${chain} (${targetChainId})`);
          } catch (e) {
            console.warn("Failed to resolve chain:", chain);
          }
        }
      } else {
        // Try transfer/send patterns: "send X token to address on chain"
        const transferMatch = ctx.raw.match(/(?:send|transfer)\s+[\d.]+\s+(\w+)(?:\s+to\s+[^\s]+)?(?:\s+on\s+(\w+))?/i);
        if (transferMatch) {
          ambiguousSymbol = transferMatch[1];
          const chain = transferMatch[2];
          
          if (chain) {
            try {
              const { resolveChain } = await import("@/lib/chains/registry");
              targetChainId = resolveChain(chain).id;
              console.log(`✅ Extracted chain from transfer pattern: ${chain} (${targetChainId})`);
            } catch (e) {
              console.warn("Failed to resolve chain:", chain);
            }
          }
        } else {
          // Try bridge patterns: "bridge X token from chain1 to chain2"
          const bridgeMatch = ctx.raw.match(/bridge\s+[\d.]+\s+(\w+)(?:\s+from\s+(\w+))?(?:\s+to\s+(\w+))?/i);
          if (bridgeMatch) {
            ambiguousSymbol = bridgeMatch[1];
            const fromChain = bridgeMatch[2];
            const toChain = bridgeMatch[3];
            
            // Prioritize fromChain for bridge token lookups
            const chain = fromChain || toChain;
            if (chain) {
              try {
                const { resolveChain } = await import("@/lib/chains/registry");
                targetChainId = resolveChain(chain).id;
                console.log(`✅ Extracted chain from bridge pattern: ${chain} (${targetChainId})`);
              } catch (e) {
                console.warn("Failed to resolve chain:", chain);
              }
            }
          }
        }
      }

      console.log("🔍 Detected ambiguous token symbol:", ambiguousSymbol);

      // Import and use our enhanced token resolver
      try {
        const { resolveTokensMultiProvider } = await import("@/lib/normalize");
        const { resolveChain } = await import("@/lib/chains/registry");

        // PRIORITY 2: If no chain from raw input, try intent result
        if (!targetChainId) {
          const intentChain = (intentResult as any).intent?.chain ||
                             (intentResult as any).intent?.fromChain;
          if (intentChain) {
            targetChainId = typeof intentChain === 'number'
              ? intentChain
              : resolveChain(intentChain).id;
            console.log(`✅ Using chain from intent result: ${intentChain} (${targetChainId})`);
          }
        }

        // PRIORITY 3: Fall back to current chain only if nothing else found
        if (!targetChainId) {
          targetChainId = core.chainId;
          console.log(`⚠️ No chain specified, falling back to current chain: ${targetChainId}`);
        }

        console.log("🚀 Calling enhanced token resolver for symbol:", ambiguousSymbol, "on chain:", targetChainId);
        const enhancedResult = await resolveTokensMultiProvider(ambiguousSymbol, targetChainId);

        console.log("✅ Enhanced resolver returned", enhancedResult.tokens.length, "tokens");

        // Convert to the expected tokenSelection format
        const enhancedTokenSelection = {
          message: enhancedResult.message || `Multiple tokens found for '${ambiguousSymbol}'. Please select:`,
          tokens: enhancedResult.tokens.map((token, index) => ({
            id: index + 1,
            chainId: token.chainId,
            address: token.address,
            name: token.name,
            symbol: token.symbol,
            logoURI: token.logoURI,
            verified: token.verified,
          })),
        };

        dispatch({
          type: "INTENT.TOKEN_SELECTION",
          tokenSelection: enhancedTokenSelection,
        });
      } catch (error) {
        console.error("❌ Enhanced token resolver failed, falling back to AI tokens:", error);
        // Fallback to original AI response if enhanced resolver fails
        dispatch({
          type: "INTENT.TOKEN_SELECTION",
          tokenSelection: intentResult.tokenSelection,
        });
      }
      return;
    }

    if (isIntentSuccess(intentResult)) {
      console.log("✅ Intent parsed successfully:", intentResult.intent);
      dispatch({
        type: "INTENT.OK",
        intent: intentResult.intent,
      });
      return;
    }

    // Fallback for unexpected response format
    dispatch({
      type: "INTENT.CLARIFY",
      prompt:
        "Could not understand your request. Please try again with more specific details.",
      missing: ["action"],
    });
  } catch (error: any) {
    if (signal.aborted) return;

    console.error("Intent parsing error:", error);

    // Handle specific error types
    if (error.name === "IntentParseError") {
      dispatch({
        type: "INTENT.CLARIFY",
        prompt: error.message || "Please clarify your request",
        missing: ["action"],
      });
    } else {
      dispatch({
        type: "INTENT.CLARIFY",
        prompt: "Failed to process your request. Please try again.",
        missing: ["action"],
      });
    }
  }
};
