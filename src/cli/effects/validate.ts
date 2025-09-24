// Validation effects using existing orchestrator logic
import type { StepDef } from "../state/types";
import { validateIntent } from "@/lib/validation";

export const validateFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  if (!ctx.norm) {
    dispatch({
      type: "VALIDATE.FAIL",
      error: {
        code: "MISSING_NORM",
        message: "No normalized data to validate",
        phase: "validate",
      },
    });
    return;
  }

  if (!core.saAddress) {
    dispatch({
      type: "VALIDATE.FAIL",
      error: {
        code: "MISSING_SA_ADDRESS",
        message: "Smart Account address not available",
        phase: "validate",
      },
    });
    return;
  }

  try {
    console.log("🔄 Validating transaction:", ctx.norm);

    const { gasEstimate, gasCost } = await validateIntent(ctx.norm, core.saAddress);

    if (signal.aborted) return;

    console.log("✅ Validation passed", { gasEstimate, gasCost });
    dispatch({ type: "VALIDATE.OK" });
  } catch (error: any) {
    if (signal.aborted) return;

    console.error("Validation error:", error);

    dispatch({
      type: "VALIDATE.FAIL",
      error: {
        code: error.code || "VALIDATION_ERROR",
        message: error.message || "Transaction validation failed",
        detail: error,
        phase: "validate",
      },
    });
  }
};