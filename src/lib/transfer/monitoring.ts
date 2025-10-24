// lib/transfer/monitoring.ts - Transfer-specific monitoring (isolated)

import { createPublicClient, http } from "viem";
import type { TransferMonitoringResult } from "./types";
import { TransferError } from "./errors";
import { getChainConfig } from "../chains/registry";

/**
 * Monitor transfer transaction
 */
export async function monitorTransfer(
  chainId: number,
  txHash: string,
  requiredConfirmations: number = 1
): Promise<TransferMonitoringResult> {

  const chainConfig = getChainConfig(chainId);
  if (!chainConfig) {
    throw new TransferError(
      `Chain configuration not found for chainId: ${chainId}`,
      "CHAIN_CONFIG_MISSING",
      "monitor"
    );
  }

  const publicClient = createPublicClient({
    chain: chainConfig.wagmiChain,
    transport: http(chainConfig.rpcUrl),
  });

  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      confirmations: requiredConfirmations,
    });

    if (receipt.status === "success") {
      return {
        status: "confirmed",
        confirmations: requiredConfirmations,
      };
    } else {
      console.error(`❌ [Transfer] Transaction failed: ${txHash}`);
      return {
        status: "failed",
        error: "Transaction reverted",
      };
    }
  } catch (error: any) {
    console.error(`[Transfer] Monitoring error for ${txHash}:`, error);
    return {
      status: "failed",
      error: error.message || "Failed to monitor transaction",
    };
  }
}
