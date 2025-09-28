// Normalize effects using existing orchestrator logic
import type { StepDef } from "../state/types";
import { normalizeIntent, TokenSelectionError } from "@/lib/normalize";

export const normalizeFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
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

  try {
    console.log("🔄 Normalizing intent:", ctx.intent);

    const norm = await normalizeIntent({ ok: true, intent: ctx.intent });

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