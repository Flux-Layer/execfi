// Enhanced transaction monitoring effects with LI.FI integration
import type { StepDef } from "../state/types";
import { monitorTransaction, formatMonitoringStatus } from "@/lib/monitor";

/**
 * Enhanced monitoring effect that integrates with LI.FI status tracking
 * Step 3.4: LI.FI Status Tracking Integration (Step 7.6 Enhancement)
 */
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
    console.log("🔄 Enhanced monitoring with LI.FI integration:", ctx.exec.hash);

    // Add monitoring status to chat
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: "⏳ Monitoring transaction confirmation with enhanced tracking...",
        timestamp: Date.now(),
      },
    });

    // First attempt with enhanced LI.FI monitoring
    let usedLifiTracking = false;

    try {
      // Check if this transaction might benefit from LI.FI tracking
      // (complex routes, cross-chain, or when LI.FI execution was used)
      const shouldUseLifiTracking = process.env.ENABLE_LIFI_EXECUTION === 'true' ||
                                   (ctx.norm as any)?.kind === 'swap' ||
                                   (ctx.norm as any)?.kind === 'bridge' ||
                                   (ctx.norm as any)?.kind === 'bridge-swap';

      if (shouldUseLifiTracking) {
        console.log("🔄 Attempting LI.FI enhanced tracking...");
        const lifiStatus = await getLifiTransactionStatus(ctx.exec.hash, ctx.norm);

        if (lifiStatus && lifiStatus.success) {
          usedLifiTracking = true;
          console.log("✅ LI.FI tracking successful:", lifiStatus.status.enhanced);

          // Update chat with enhanced status
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: formatLifiStatusMessage(lifiStatus.status.enhanced),
              timestamp: Date.now(),
            },
          });

          // Check if transaction is complete via LI.FI
          if (lifiStatus.status.enhanced.isCompleted) {
            dispatch({ type: "MONITOR.OK" });

            dispatch({
              type: "CHAT.ADD",
              message: {
                role: "assistant",
                content: `✅ Transaction completed successfully via LI.FI tracking!`,
                timestamp: Date.now(),
              },
            });
            return;
          } else if (lifiStatus.status.enhanced.isFailed) {
            dispatch({
              type: "MONITOR.FAIL",
              error: {
                code: "TX_FAILED_LIFI",
                message: lifiStatus.status.enhanced.errorMessage || "Transaction failed (LI.FI tracking)",
                detail: lifiStatus,
                phase: "monitor",
              },
            });
            return;
          }
        }
      }
    } catch (lifiError) {
      console.warn("⚠️ LI.FI tracking failed, falling back to standard monitoring:", lifiError);
    }

    // Fallback to standard viem-based monitoring
    console.log("🔄 Using standard viem monitoring as fallback...");
    const status = await monitorTransaction(core.chainId, ctx.exec.hash);

    if (signal.aborted) return;

    console.log("📊 Transaction status:", formatMonitoringStatus(status));

    if (status.status === "confirmed") {
      dispatch({ type: "MONITOR.OK" });

      // Add confirmation message with tracking method info
      const trackingMethod = usedLifiTracking ? "LI.FI + viem" : "viem";
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `✅ Transaction confirmed! Block: ${status.receipt?.blockNumber} (tracked via ${trackingMethod})`,
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

    console.error("Enhanced monitoring error:", error);

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

/**
 * Get LI.FI transaction status using the new status API
 */
async function getLifiTransactionStatus(txHash: string, norm: any) {
  try {
    const response = await fetch('/api/lifi/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        txHash,
        fromChain: norm?.chainId,
        toChain: norm?.toChainId || norm?.chainId,
      }),
    });

    if (!response.ok) {
      throw new Error(`LI.FI status API failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("LI.FI status tracking failed:", error);
    return null;
  }
}

/**
 * Format LI.FI enhanced status for user display
 */
function formatLifiStatusMessage(enhanced: any): string {
  if (enhanced.isCompleted) {
    return `✅ Transaction completed (${enhanced.progressPercent}% - ${enhanced.nextAction})`;
  }

  if (enhanced.isFailed) {
    return `❌ Transaction failed: ${enhanced.errorMessage || 'Unknown error'}`;
  }

  if (enhanced.isPending) {
    const progress = enhanced.progressPercent || 0;
    const eta = enhanced.estimatedTimeRemaining ? ` (ETA: ${enhanced.estimatedTimeRemaining})` : '';
    return `⏳ Transaction in progress (${progress}%): ${enhanced.nextAction}${eta}`;
  }

  return `🔄 Transaction status: ${enhanced.nextAction || 'Checking...'}`;
}