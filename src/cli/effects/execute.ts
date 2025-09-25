// Execution effects using existing orchestrator logic
import type { StepDef } from "../state/types";
import { executeIntent, getSmartAccountAddress } from "@/lib/execute";
import { validateNoDuplicate, updateTransactionStatus } from "@/lib/idempotency";

export const executePrivyFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  if (!ctx.norm) {
    dispatch({
      type: "EXEC.FAIL",
      error: {
        code: "MISSING_NORM",
        message: "No normalized data to execute",
        phase: "execute",
      },
    });
    return;
  }

  if (!core.smartWalletClient) {
    dispatch({
      type: "EXEC.FAIL",
      error: {
        code: "AUTH_REQUIRED",
        message: "Please log in to execute transactions. You can continue using the terminal to explore, but transactions require authentication.",
        phase: "execute",
      },
    });
    return;
  }

  let promptId: string | undefined;

  try {
    console.log("🔄 Executing transaction...");

    // Check for idempotency (skip if no userId - unauthenticated users)
    try {
      if (core.userId) {
        promptId = validateNoDuplicate(core.userId, ctx.norm);
        console.log("✅ No duplicates found, promptId:", promptId);
      } else {
        console.log("⚠️ Skipping idempotency check - user not authenticated");
      }
    } catch (error: any) {
      if (error.name === "IdempotencyError") {
        dispatch({
          type: "EXEC.FAIL",
          error: {
            code: "DUPLICATE_TRANSACTION",
            message: error.message,
            detail: { existingTxHash: error.existingTxHash },
            phase: "execute",
          },
        });
        return;
      }
      throw error;
    }

    // Get smart account address
    const smartAccountAddress = getSmartAccountAddress(core.saAddress);
    console.log("✅ Smart Account address:", smartAccountAddress);

    // Execute the transaction
    const executionResult = await executeIntent(core.smartWalletClient, ctx.norm);

    if (signal.aborted) return;

    console.log("✅ Transaction executed:", executionResult.txHash);

    // Update idempotency status
    if (promptId) {
      updateTransactionStatus(promptId, "completed", executionResult.txHash);
    }

    dispatch({
      type: "EXEC.OK",
      hash: executionResult.txHash as `0x${string}`,
      explorerUrl: executionResult.explorerUrl,
    });

    // Add success message to chat
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: executionResult.message,
        timestamp: Date.now(),
      },
    });

    // Add explorer link to chat
    if (executionResult.explorerUrl && executionResult.txHash) {
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: {
            type: "explorer-link",
            url: executionResult.explorerUrl,
            text: `View transaction: ${executionResult.txHash}`,
            explorerName: "BaseScan",
          },
          timestamp: Date.now(),
        },
      });
    }
  } catch (error: any) {
    if (signal.aborted) return;

    console.error("Execution error:", error);

    // Update idempotency status on failure
    if (promptId) {
      updateTransactionStatus(promptId, "failed");
    }

    let errorCode = "EXECUTION_ERROR";
    let errorMessage = "Transaction execution failed";

    // Handle specific error types
    if (error.name === "ExecutionError") {
      errorCode = error.code;
      errorMessage = error.message;
    } else if (error.code) {
      errorCode = error.code;
      errorMessage = error.message || errorMessage;
    }

    dispatch({
      type: "EXEC.FAIL",
      error: {
        code: errorCode,
        message: errorMessage,
        detail: error,
        phase: "execute",
      },
    });
  }
};