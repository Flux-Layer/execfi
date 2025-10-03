// Execution effects using existing orchestrator logic
import type { StepDef } from "../state/types";
import { executeIntent, getSmartAccountAddress } from "@/lib/execute";
import { validateNoDuplicate, updateTransactionStatus } from "@/lib/idempotency";
import { getIntentAmountETH } from "@/lib/policy/checker";
import {
  getIntentChainId,
  requestChainSwitch,
  switchWalletChain,
  waitForChainPropagation
} from "@/lib/chain-utils";
import { getChainConfig } from "@/lib/chains/registry";

export const executePrivyFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  console.log("🔍 Execute effect - Full context:", {
    hasNorm: !!ctx.norm,
    normKind: ctx.norm?.kind,
    hasPlan: !!ctx.plan,
    planKeys: ctx.plan ? Object.keys(ctx.plan) : [],
    hasRoute: !!ctx.plan?.route,
  });

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

  // Determine account mode and validate required clients
  const accountMode = core.accountMode || "EOA";

  if (accountMode === "SMART_ACCOUNT" && !core.smartWalletClient) {
    dispatch({
      type: "EXEC.FAIL",
      error: {
        code: "AUTH_REQUIRED",
        message: "Smart Account client not available. Please log in to execute transactions.",
        phase: "execute",
      },
    });
    return;
  }

  if (accountMode === "EOA" && (!core.eoaSendTransaction || !core.selectedWallet)) {
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

  // ============================================================================
  // CHAIN SYNCHRONIZATION LOGIC
  // ============================================================================

  let targetChainId: number;
  try {
    targetChainId = getIntentChainId(ctx.norm);
  } catch (error) {
    dispatch({
      type: "EXEC.FAIL",
      error: {
        code: "INVALID_CHAIN",
        message: "Cannot determine target chain for transaction",
        phase: "execute",
      },
    });
    return;
  }

  const targetChainConfig = getChainConfig(targetChainId);
  if (!targetChainConfig) {
    dispatch({
      type: "EXEC.FAIL",
      error: {
        code: "CHAIN_CONFIG_MISSING",
        message: `Chain configuration not found for chain ${targetChainId}`,
        phase: "execute",
      },
    });
    return;
  }

  // Check if chain switch is needed
  const needsChainSwitch = core.chainId !== targetChainId;

  if (needsChainSwitch) {
    const currentChain = getChainConfig(core.chainId);

    console.log(`🔄 Chain switch required: ${currentChain?.name || core.chainId} → ${targetChainConfig.name || targetChainId}`);

    // Notify user about chain switch
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: `🔄 Switching chains: ${currentChain?.name || core.chainId} → ${targetChainConfig.name}...`,
        timestamp: Date.now(),
      },
    });

    // 1. Request chain switch in application state
    const chainSwitchSuccess = await requestChainSwitch(targetChainId);

    if (!chainSwitchSuccess) {
      dispatch({
        type: "EXEC.FAIL",
        error: {
          code: "CHAIN_SWITCH_FAILED",
          message: `Failed to switch to ${targetChainConfig.name} (${targetChainId})`,
          phase: "execute",
        },
      });
      return;
    }

    console.log(`✅ Application chain state switched to ${targetChainId}`);

    // 2. Switch wallet chain if in EOA mode
    if (accountMode === "EOA" && core.selectedWallet) {
      const walletSwitchResult = await switchWalletChain(
        core.selectedWallet,
        targetChainId
      );

      if (walletSwitchResult.success) {
        console.log(`✅ Wallet chain switched to ${targetChainId}`);
      } else {
        // Log warning but continue - some embedded wallets may not need explicit switching
        console.warn(`⚠️ Wallet chain switch warning (may not be critical): ${walletSwitchResult.error}`);
      }
    }

    // 3. Wait for state propagation
    await waitForChainPropagation(500);

    // 4. Confirm user about successful switch
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: `✅ Switched to ${targetChainConfig.name}`,
        timestamp: Date.now(),
      },
    });
  } else {
    console.log(`✅ Already on correct chain: ${targetChainId}`);
  }

  // ============================================================================
  // END: CHAIN SYNCHRONIZATION LOGIC
  // ============================================================================

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

    // Get the appropriate address for logging
    let executionAddress: string;
    if (accountMode === "SMART_ACCOUNT") {
      executionAddress = getSmartAccountAddress(core.saAddress);
      console.log("✅ Smart Account address:", executionAddress);
    } else {
      executionAddress = core.selectedWallet!.address;
      console.log("✅ EOA address:", executionAddress);
    }

    // Execute the transaction with the appropriate mode and clients
    // Pass route from plan context if available (for swap/bridge operations)
    const route = ctx.plan?.route;
    const executionResult = await executeIntent(
      ctx.norm,
      accountMode,
      {
        smartWalletClient: core.smartWalletClient,
        eoaSendTransaction: core.eoaSendTransaction,
        selectedWallet: core.selectedWallet,
      },
      route
    );

    if (signal.aborted) return;

    console.log(`✅ Transaction executed via ${accountMode}:`, executionResult.txHash);

    // Update idempotency status
    if (promptId) {
      updateTransactionStatus(promptId, "completed", executionResult.txHash);
    }

    dispatch({
      type: "EXEC.OK",
      hash: executionResult.txHash as `0x${string}`,
      explorerUrl: executionResult.explorerUrl,
    });

    // Track transaction in policy
    const amountETH = getIntentAmountETH(ctx.norm);
    dispatch({ type: "POLICY.TX_TRACKED", amountETH });

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