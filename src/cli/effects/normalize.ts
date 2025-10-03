// Normalize effects using existing orchestrator logic
import type { StepDef } from "../state/types";
import { normalizeIntent, TokenSelectionError } from "@/lib/normalize";
import { verifyChainConsistency } from "@/lib/chain-utils";
import { resolveChain } from "@/lib/chains/registry";
import { transferNormalizeFx } from "./transfer/normalize";

export const normalizeFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  // Route transfers to isolated transfer effect
  if (ctx.intent?.action === "transfer") {
    console.log("🔀 [Main Effect] Routing to isolated transfer normalization");
    if (transferNormalizeFx) {
      return await transferNormalizeFx(ctx, core, dispatch, signal);
    }
  }
  if (!ctx.intent) {
    dispatch({
      type: "NORMALIZE.FAIL",
      error: {
        code: "MISSING_INTENT",
        message: "No intent to normalize",
        phase: "normalize",
      },
    });
    return;
  }

  // ============================================================================
  // EARLY CHAIN DETECTION AND WARNING
  // ============================================================================

  let requiredChainId: number | undefined;
  let requiredChainName: string | undefined;

  try {
    if (ctx.intent.action === 'swap') {
      const swapIntent = ctx.intent as any;
      const fromChainConfig = resolveChain(swapIntent.fromChain);
      requiredChainId = fromChainConfig.id;
      requiredChainName = fromChainConfig.name;
    } else if (ctx.intent.action === 'bridge' || ctx.intent.action === 'bridge_swap') {
      const bridgeIntent = ctx.intent as any;
      const fromChainConfig = resolveChain(bridgeIntent.fromChain);
      requiredChainId = fromChainConfig.id;
      requiredChainName = fromChainConfig.name;
    } else if (ctx.intent.action === 'transfer') {
      const transferIntent = ctx.intent as any;
      const chainConfig = resolveChain(transferIntent.chain);
      requiredChainId = chainConfig.id;
      requiredChainName = chainConfig.name;
    }
  } catch (error) {
    console.warn("Could not determine required chain during normalization:", error);
  }

  if (requiredChainId && requiredChainId !== core.chainId) {
    const verification = verifyChainConsistency(
      core.chainId,
      requiredChainId,
      "Normalization"
    );

    if (!verification.consistent && verification.warning) {
      console.log(`⚠️ ${verification.warning}`);
      console.log(`Transaction will auto-switch to ${requiredChainName} (${requiredChainId}) during execution`);

      // Add informational message to chat
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `ℹ️ This transaction requires ${requiredChainName}. The chain will be switched automatically.`,
          timestamp: Date.now(),
        },
      });
    }
  }

  // ============================================================================
  // END: EARLY CHAIN DETECTION AND WARNING
  // ============================================================================

  try {
    console.log("🔄 Normalizing intent:", ctx.intent);

    // Get sender address for swap/bridge operations
    const senderAddress = core.accountMode === "SMART_ACCOUNT"
      ? core.saAddress
      : core.selectedWallet?.address;

    const norm = await normalizeIntent(
      { ok: true, intent: ctx.intent },
      {
        preferredChainId: core.chainId,
        senderAddress: senderAddress as `0x${string}` | undefined
      }
    );

    if (signal.aborted) return;

    console.log("✅ Intent normalized:", norm);
    dispatch({
      type: "NORMALIZE.OK",
      norm,
    });
  } catch (error: any) {
    if (signal.aborted) return;

    console.error("Normalization error:", error);

    // Handle token selection error specially
    if (error instanceof TokenSelectionError) {
      dispatch({
        type: "INTENT.TOKEN_SELECTION",
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
      });
      return;
    }

    // Handle other normalization errors
    dispatch({
      type: "NORMALIZE.FAIL",
      error: {
        code: error.code || "NORMALIZE_ERROR",
        message: error.message || "Failed to normalize transaction details",
        detail: error,
        phase: "normalize",
      },
    });
  }
};
