// cli/effects/transfer/execute.ts - Transfer-specific execution effect

import type { StepDef } from "../../state/types";
import { executeTransfer } from "@/lib/transfer/execution";
import type { NormalizedTransfer } from "@/lib/transfer/types";
import { validateNoDuplicate, updateTransactionStatus } from "@/lib/idempotency";
import { getChainConfig } from "@/lib/chains/registry";
import { createWalletClient, http, type WalletClient } from "viem";

export const transferExecuteFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  console.log("⚡ [Transfer Effect] Starting execution");

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

  // Validate this is a transfer operation
  if (ctx.norm.kind !== "native-transfer" && ctx.norm.kind !== "erc20-transfer") {
    dispatch({
      type: "EXEC.FAIL",
      error: {
        code: "INVALID_OPERATION",
        message: `Expected transfer operation, got ${ctx.norm.kind}`,
        phase: "execute",
      },
    });
    return;
  }

  const norm = ctx.norm as NormalizedTransfer;

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
        message: "Please log in to execute transactions.",
        phase: "execute",
      },
    });
    return;
  }

  // Chain synchronization
  const targetChainId = norm.chainId;
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

  // ============================================================================
  // CHAIN VALIDATION (chain should already be switched during normalize)
  // ============================================================================

  if (core.chainId !== targetChainId) {
    const currentChain = getChainConfig(core.chainId);
    console.error(
      `[Transfer Effect] Chain mismatch at execution: expected ${targetChainId}, got ${core.chainId}`
    );

    dispatch({
      type: "EXEC.FAIL",
      error: {
        code: "CHAIN_MISMATCH",
        message: `Execution chain mismatch. Expected ${targetChainConfig.name}, but currently on ${
          currentChain?.name || core.chainId
        }. This should not happen - chain switch should have occurred during normalization.`,
        phase: "execute",
      },
    });
    return;
  }

  console.log(`✅ [Transfer Effect] Chain validation passed: ${targetChainId}`);

  // ============================================================================
  // END: CHAIN VALIDATION
  // ============================================================================

  // Idempotency check
  if (core.userId) {
    try {
      validateNoDuplicate(core.userId, norm);
    } catch (error: any) {
      dispatch({
        type: "EXEC.FAIL",
        error: {
          code: "DUPLICATE_TRANSACTION",
          message: error.message || "This transaction was already submitted recently",
          phase: "execute",
        },
      });
      return;
    }
  }

  // Execute the transfer
  try {
    console.log("⚡ [Transfer Effect] Executing transfer on chain:", targetChainId);

    let txHash: string;
    let explorerUrl: string;

    if (accountMode === "SMART_ACCOUNT") {
      // Smart account execution
      const walletClient = core.smartWalletClient as WalletClient;
      const fromAddress = core.saAddress!;
      const gasEstimate = 500000n; // TODO: Get from validation

      const result = await executeTransfer(norm, walletClient, fromAddress, gasEstimate);
      txHash = result.txHash;
      explorerUrl = result.explorerUrl;
    } else {
      // EOA execution
      const fromAddress = core.selectedWallet!.address as `0x${string}`;

      // Create wallet client for EOA
      const walletClient = createWalletClient({
        chain: targetChainConfig.wagmiChain,
        transport: http(targetChainConfig.rpcUrl),
      });

      const gasEstimate = 500000n; // TODO: Get from validation

      const result = await executeTransfer(norm, walletClient, fromAddress, gasEstimate);
      txHash = result.txHash;
      explorerUrl = result.explorerUrl;
    }

    console.log(`✅ [Transfer Effect] Transfer submitted: ${txHash}`);

    // Update idempotency tracking (using promptId from idempotency store)
    // Note: The promptId is generated during validateNoDuplicate
    // For now, we skip this update as we don't have access to the promptId
    // TODO: Refactor idempotency system to return promptId from validateNoDuplicate

    dispatch({
      type: "EXEC.OK",
      hash: txHash as `0x${string}`,
      explorerUrl,
    });
  } catch (error: any) {
    console.error("[Transfer Effect] Execution error:", error);

    dispatch({
      type: "EXEC.FAIL",
      error: {
        code: error.code || "EXECUTION_ERROR",
        message: error.message || "Transfer execution failed",
        detail: error,
        phase: "execute",
      },
    });
  }
};
