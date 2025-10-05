// cli/effects/transfer/execute.ts - Transfer-specific execution effect

import type { StepDef } from "../../state/types";
import { executeTransfer } from "@/lib/transfer/execution";
import type { NormalizedTransfer } from "@/lib/transfer/types";
import { validateNoDuplicate, updateTransactionStatus } from "@/lib/idempotency";
import { getChainConfig } from "@/lib/chains/registry";
import { getTxUrl } from "@/lib/explorer";
import { createWalletClient, http, type WalletClient } from "viem";

// Feature flag for LIFI execution path
const ENABLE_LIFI_EXECUTION = process.env.NEXT_PUBLIC_ENABLE_LIFI_EXECUTION === "true";

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
      // EOA execution using Privy's sendTransaction (has signing capability)
      const fromAddress = core.selectedWallet!.address as `0x${string}`;

      console.log("🔄 [Transfer Effect] Using EOA send transaction");

      if (ENABLE_LIFI_EXECUTION) {
        // Use LIFI preparation API for EntryPoint routing
        console.log("🔄 [Transfer Effect] Using LIFI preparation API");

        const prepareRequest = {
          fromChain: norm.chainId,
          toChain: norm.chainId,
          fromToken: norm.kind === "native-transfer"
            ? "0x0000000000000000000000000000000000000000"
            : norm.token.address,
          toToken: norm.kind === "native-transfer"
            ? "0x0000000000000000000000000000000000000000"
            : norm.token.address,
          amount: norm.amountWei.toString(),
          fromAddress,
          toAddress: norm.to,
          slippage: 0.005,
          routePreference: "recommended",
          validateFreshness: true,
        };

        const response = await fetch("/api/lifi/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prepareRequest),
        });

        if (!response.ok) {
          throw new Error(`LIFI preparation failed: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success || !result.transactionData) {
          throw new Error(result.error?.message || "LIFI preparation failed");
        }

        // Handle approval if required (ERC-20)
        if (result.requiresApproval) {
          console.log("🔐 Approval required, executing approval transaction");

          const { encodeFunctionData } = await import("viem");
          const approvalData = encodeFunctionData({
            abi: [
              {
                name: "approve",
                type: "function",
                inputs: [
                  { name: "spender", type: "address" },
                  { name: "amount", type: "uint256" },
                ],
                outputs: [{ name: "", type: "bool" }],
                stateMutability: "nonpayable",
              },
            ],
            functionName: "approve",
            args: [result.requiresApproval.spender, BigInt(result.requiresApproval.amount)],
          });

          const approvalResult = await core.eoaSendTransaction!(
            {
              to: result.requiresApproval.token as `0x${string}`,
              value: 0n,
              data: approvalData,
            },
            { address: fromAddress }
          );

          console.log(`✅ Approval submitted: ${approvalResult.hash}`);

          // Wait for approval confirmation
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // Execute main transaction
        const txData = result.transactionData;
        const txResult = await core.eoaSendTransaction!(
          {
            to: txData.to as `0x${string}`,
            value: BigInt(txData.value),
            data: txData.data as `0x${string}` | undefined,
          },
          { address: fromAddress }
        );

        txHash = txResult.hash;
      } else {
        // Direct execution (fallback when LIFI disabled)
        if (norm.kind === "native-transfer") {
          // Native transfer
          const result = await core.eoaSendTransaction!(
            {
              to: norm.to,
              value: norm.amountWei,
            },
            {
              address: fromAddress,
            }
          );
          txHash = result.hash;
        } else {
          // ERC-20 transfer
          const { encodeFunctionData } = await import("viem");
          const data = encodeFunctionData({
            abi: [
              {
                name: "transfer",
                type: "function",
                stateMutability: "nonpayable",
                inputs: [
                  { name: "to", type: "address" },
                  { name: "amount", type: "uint256" },
                ],
                outputs: [{ name: "", type: "bool" }],
              },
            ],
            functionName: "transfer",
            args: [norm.to, norm.amountWei],
          });

          const result = await core.eoaSendTransaction!(
            {
              to: norm.token.address,
              value: 0n,
              data,
            },
            {
              address: fromAddress,
            }
          );
          txHash = result.hash;
        }
      }

      explorerUrl = getTxUrl(targetChainId, txHash);
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

    // Add clickable explorer link to chat
    if (explorerUrl && txHash) {
      const chainName = targetChainConfig.explorerName || "Explorer";
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: {
            type: "explorer-link",
            url: explorerUrl,
            text: `View transaction: ${txHash}`,
            explorerName: chainName,
          },
          timestamp: Date.now(),
        },
      });
    }
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
