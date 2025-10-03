// cli/effects/transfer/normalize.ts - Transfer-specific normalization effect

import type { StepDef } from "../../state/types";
import { normalizeTransferIntent } from "@/lib/transfer/normalize";
import { TransferTokenSelectionError } from "@/lib/transfer/errors";
import { verifyChainConsistency } from "@/lib/chain-utils";
import { resolveChain } from "@/lib/chains/registry";

export const transferNormalizeFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  console.log("🔄 [Transfer Effect] Starting normalization");

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

  // Validate this is actually a transfer intent
  if (ctx.intent.action !== "transfer") {
    dispatch({
      type: "NORMALIZE.FAIL",
      error: {
        code: "INVALID_ACTION",
        message: `Expected transfer action, got ${ctx.intent.action}`,
        phase: "normalize",
      },
    });
    return;
  }

  // Early chain detection and warning
  let requiredChainId: number | undefined;
  let requiredChainName: string | undefined;

  try {
    const transferIntent = ctx.intent as any;
    const chainConfig = resolveChain(transferIntent.chain);
    requiredChainId = chainConfig.id;
    requiredChainName = chainConfig.name;
  } catch (error) {
    console.warn("[Transfer Effect] Could not determine required chain:", error);
  }

  if (requiredChainId && requiredChainId !== core.chainId) {
    const verification = verifyChainConsistency(
      core.chainId,
      requiredChainId,
      "Transfer Normalization"
    );

    if (!verification.consistent && verification.warning) {
      console.log(`⚠️ ${verification.warning}`);
      console.log(`Transfer will auto-switch to ${requiredChainName} (${requiredChainId}) during execution`);

      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `ℹ️ This transfer requires ${requiredChainName}. The chain will be switched automatically.`,
          timestamp: Date.now(),
        },
      });
    }
  }

  try {
    console.log("🔄 [Transfer Effect] Normalizing transfer intent:", ctx.intent);

    // Use isolated transfer normalization (no preferredChainId!)
    const norm = await normalizeTransferIntent(ctx.intent as any);

    if (signal.aborted) return;

    console.log("✅ [Transfer Effect] Transfer normalized:", norm);
    dispatch({
      type: "NORMALIZE.OK",
      norm,
    });
  } catch (error: any) {
    if (signal.aborted) return;

    console.error("[Transfer Effect] Normalization error:", error);

    // Handle token selection error
    if (error instanceof TransferTokenSelectionError) {
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
            logoURI: token.logoURI || undefined,
            verified: token.verified || false,
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
        message: error.message || "Failed to normalize transfer details",
        detail: error,
        phase: "normalize",
      },
    });
  }
};
