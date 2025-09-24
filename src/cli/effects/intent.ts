// Intent parsing effects using existing orchestrator logic
import type { StepDef, Dispatch } from "../state/types";
import { parseIntent, isIntentSuccess, isIntentClarify } from "@/lib/ai";

export const parseIntentFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  if (!ctx.raw) {
    dispatch({
      type: "INTENT.CLARIFY",
      prompt: "Please provide a transaction command",
      missing: ["action"],
    });
    return;
  }

  try {
    console.log("🔄 Parsing intent:", ctx.raw);

    const intentResult = await parseIntent(ctx.raw);

    if (signal.aborted) return;

    if (isIntentClarify(intentResult)) {
      dispatch({
        type: "INTENT.CLARIFY",
        prompt: intentResult.clarify,
        missing: intentResult.missing,
      });
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
      prompt: "Could not understand your request. Please try again with more specific details.",
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