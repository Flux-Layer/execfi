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

  // Determine the correct address to use for simulation based on account mode
  const accountMode = core.accountMode || "EOA";
  let fromAddress: `0x${string}` | undefined;

  if (accountMode === "SMART_ACCOUNT") {
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
    fromAddress = core.saAddress;
  } else {
    // EOA mode
    if (!core.selectedWallet?.address) {
      dispatch({
        type: "SIM.FAIL",
        error: {
          code: "MISSING_EOA_ADDRESS",
          message: "EOA wallet address not available",
          phase: "simulate",
        },
      });
      return;
    }
    fromAddress = core.selectedWallet.address as `0x${string}`;
  }

  try {
    console.log("🔄 Simulating transaction:", ctx.norm, "using", accountMode, "mode with address:", fromAddress);

    await simulateIntent(ctx.norm, fromAddress);

    if (signal.aborted) return;

    console.log("✅ Simulation successful with", accountMode, "mode");
    dispatch({
      type: "SIM.OK",
      sim: {
        success: true,
        timestamp: Date.now(),
        accountMode,
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