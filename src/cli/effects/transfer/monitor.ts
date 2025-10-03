// cli/effects/transfer/monitor.ts - Transfer-specific monitoring effect

import type { StepDef } from "../../state/types";
import { monitorTransfer } from "@/lib/transfer/monitoring";
import type { NormalizedTransfer } from "@/lib/transfer/types";

export const transferMonitorFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  console.log("👀 [Transfer Effect] Starting monitoring");

  if (!ctx.exec?.hash) {
    dispatch({
      type: "MONITOR.FAIL",
      error: {
        code: "MISSING_HASH",
        message: "No transaction hash to monitor",
        phase: "monitor",
      },
    });
    return;
  }

  if (!ctx.norm) {
    dispatch({
      type: "MONITOR.FAIL",
      error: {
        code: "MISSING_NORM",
        message: "No normalized data for monitoring",
        phase: "monitor",
      },
    });
    return;
  }

  // Validate this is a transfer operation
  if (ctx.norm.kind !== "native-transfer" && ctx.norm.kind !== "erc20-transfer") {
    dispatch({
      type: "MONITOR.FAIL",
      error: {
        code: "INVALID_OPERATION",
        message: `Expected transfer operation, got ${ctx.norm.kind}`,
        phase: "monitor",
      },
    });
    return;
  }

  const norm = ctx.norm as NormalizedTransfer;
  const txHash = ctx.exec.hash;
  const chainId = norm.chainId;

  try {
    console.log(`👀 [Transfer Effect] Monitoring transaction ${txHash} on chain ${chainId}`);

    const result = await monitorTransfer(chainId, txHash, 1);

    if (signal.aborted) return;

    if (result.status === "confirmed") {
      console.log(`✅ [Transfer Effect] Transfer confirmed: ${txHash}`);
      dispatch({ type: "MONITOR.OK" });
    } else {
      console.error(`❌ [Transfer Effect] Transfer failed: ${txHash}`);
      dispatch({
        type: "MONITOR.FAIL",
        error: {
          code: "TRANSACTION_FAILED",
          message: result.error || "Transfer transaction failed",
          phase: "monitor",
        },
      });
    }
  } catch (error: any) {
    if (signal.aborted) return;

    console.error("[Transfer Effect] Monitoring error:", error);

    dispatch({
      type: "MONITOR.FAIL",
      error: {
        code: error.code || "MONITOR_ERROR",
        message: error.message || "Failed to monitor transfer",
        detail: error,
        phase: "monitor",
      },
    });
  }
};
