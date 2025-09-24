// Transaction monitoring effects
import type { StepDef } from "../state/types";
import { monitorTransaction, formatMonitoringStatus } from "@/lib/monitor";

export const monitorFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  if (!ctx.exec?.hash) {
    dispatch({
      type: "MONITOR.FAIL",
      error: {
        code: "MISSING_TX_HASH",
        message: "No transaction hash to monitor",
        phase: "monitor",
      },
    });
    return;
  }

  try {
    console.log("🔄 Monitoring transaction:", ctx.exec.hash);

    // Add monitoring status to chat
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: "⏳ Monitoring transaction confirmation...",
        timestamp: Date.now(),
      },
    });

    const status = await monitorTransaction(core.chainId, ctx.exec.hash);

    if (signal.aborted) return;

    console.log("📊 Transaction status:", formatMonitoringStatus(status));

    if (status.status === "confirmed") {
      dispatch({ type: "MONITOR.OK" });

      // Add confirmation message to chat
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `✅ Transaction confirmed! Block: ${status.receipt?.blockNumber}`,
          timestamp: Date.now(),
        },
      });
    } else if (status.status === "failed") {
      dispatch({
        type: "MONITOR.FAIL",
        error: {
          code: "TX_FAILED",
          message: status.error || "Transaction failed on-chain",
          detail: status,
          phase: "monitor",
        },
      });
    } else {
      // Still pending - this shouldn't happen with our monitoring setup
      dispatch({
        type: "MONITOR.FAIL",
        error: {
          code: "MONITOR_TIMEOUT",
          message: "Transaction monitoring timed out",
          detail: status,
          phase: "monitor",
        },
      });
    }
  } catch (error: any) {
    if (signal.aborted) return;

    console.error("Monitoring error:", error);

    dispatch({
      type: "MONITOR.FAIL",
      error: {
        code: error.code || "MONITOR_ERROR",
        message: error.message || "Failed to monitor transaction",
        detail: error,
        phase: "monitor",
      },
    });
  }
};