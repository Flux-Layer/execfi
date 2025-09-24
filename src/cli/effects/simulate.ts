// Simulation effects using existing orchestrator logic
import type { StepDef } from "../state/types";
import { simulateIntent } from "@/lib/validation";

export const simulateGasFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  if (!ctx.norm) {
    dispatch({
      type: "SIM.FAIL",
      error: {
        code: "MISSING_NORM",
        message: "No normalized data to simulate",
        phase: "simulate",
      },
    });
    return;
  }

  if (!core.saAddress) {
    dispatch({
      type: "SIM.FAIL",
      error: {
        code: "MISSING_SA_ADDRESS",
        message: "Smart Account address not available",
        phase: "simulate",
      },
    });
    return;
  }

  try {
    console.log("🔄 Simulating transaction:", ctx.norm);

    await simulateIntent(ctx.norm, core.saAddress);

    if (signal.aborted) return;

    console.log("✅ Simulation successful");
    dispatch({
      type: "SIM.OK",
      sim: {
        success: true,
        timestamp: Date.now(),
      },
    });
  } catch (error: any) {
    if (signal.aborted) return;

    console.error("Simulation error:", error);

    dispatch({
      type: "SIM.FAIL",
      error: {
        code: error.code || "SIMULATION_ERROR",
        message: error.message || "Transaction simulation failed",
        detail: error,
        phase: "simulate",
      },
    });
  }
};

// Skip effect for flows that don't need planning
export const skipFx: StepDef["onEnter"] = (ctx, core, dispatch, signal) => {
  if (signal.aborted) return;

  console.log("⏭️ Skipping step");
  setTimeout(() => {
    if (!signal.aborted) {
      dispatch({ type: "PLAN.OK", plan: { skipped: true } });
    }
  }, 0);
};