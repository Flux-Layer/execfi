// lib/transfer/execution.ts - Transfer-specific execution (isolated)

import {
  createWalletClient,
  http,
  type WalletClient,
  erc20Abi,
} from "viem";
import type { NormalizedTransfer, TransferExecutionResult } from "./types";
import { TransferExecutionError } from "./errors";
import { getChainConfig } from "../chains/registry";
import { getTxUrl } from "../explorer";

/**
 * Execute native transfer
 */
async function executeNativeTransfer(
  norm: NormalizedTransfer & { kind: "native-transfer" },
  walletClient: WalletClient,
  fromAddress: `0x${string}`,
  gasEstimate: bigint
): Promise<TransferExecutionResult> {
  console.log("🚀 [Transfer] Executing native transfer:", norm);

  try {
    const txHash = await walletClient.sendTransaction({
      account: fromAddress,
      to: norm.to,
      value: norm.amountWei,
      gas: gasEstimate,
      chain: walletClient.chain,
    });

    const explorerUrl = getTxUrl(norm.chainId, txHash);

    console.log(`✅ [Transfer] Native transfer submitted: ${txHash}`);

    return {
      success: true,
      txHash,
      explorerUrl,
      message: "Transfer submitted successfully",
    };
  } catch (error: any) {
    console.error("[Transfer] Native transfer execution failed:", error);
    throw new TransferExecutionError(
      error.message || "Failed to execute native transfer",
      "EXECUTION_FAILED"
    );
  }
}

/**
 * Execute ERC-20 transfer
 */
async function executeERC20Transfer(
  norm: NormalizedTransfer & { kind: "erc20-transfer" },
  walletClient: WalletClient,
  fromAddress: `0x${string}`,
  gasEstimate: bigint
): Promise<TransferExecutionResult> {
  console.log("🚀 [Transfer] Executing ERC-20 transfer:", norm);

  try {
    const txHash = await walletClient.writeContract({
      account: fromAddress,
      address: norm.token.address,
      abi: erc20Abi,
      functionName: "transfer",
      args: [norm.to, norm.amountWei],
      gas: gasEstimate,
      chain: walletClient.chain,
    });

    const explorerUrl = getTxUrl(norm.chainId, txHash);

    console.log(`✅ [Transfer] ERC-20 transfer submitted: ${txHash}`);

    return {
      success: true,
      txHash,
      explorerUrl,
      message: "Transfer submitted successfully",
    };
  } catch (error: any) {
    console.error("[Transfer] ERC-20 transfer execution failed:", error);
    throw new TransferExecutionError(
      error.message || "Failed to execute ERC-20 transfer",
      "EXECUTION_FAILED"
    );
  }
}

/**
 * Main execution function for transfers
 */
export async function executeTransfer(
  norm: NormalizedTransfer,
  walletClient: WalletClient,
  fromAddress: `0x${string}`,
  gasEstimate: bigint
): Promise<TransferExecutionResult> {
  console.log("⚡ [Transfer] Executing transfer on chain:", norm.chainId);

  // Execute based on transfer type
  if (norm.kind === "native-transfer") {
    return await executeNativeTransfer(norm, walletClient, fromAddress, gasEstimate);
  } else {
    return await executeERC20Transfer(norm, walletClient, fromAddress, gasEstimate);
  }
}
