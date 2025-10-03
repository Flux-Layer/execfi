// Chain synchronization utilities for transaction flows

import { getChainConfig } from "@/lib/chains/registry";
import type { NormalizedIntent } from "@/lib/normalize";

/**
 * Extract target chain ID from normalized intent
 */
export function getIntentChainId(norm: NormalizedIntent): number {
  if ('chainId' in norm) {
    return norm.chainId;
  }
  if ('fromChainId' in norm) {
    return norm.fromChainId;
  }
  throw new Error('Cannot determine chain ID from normalized intent');
}

/**
 * Request chain switch via custom event
 * Returns promise that resolves when switch completes
 */
export async function requestChainSwitch(targetChainId: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(new CustomEvent('chain-switch-request', {
      detail: { chainId: targetChainId, resolve }
    }));
  });
}

/**
 * Switch wallet chain for EOA mode
 * Swallows errors for wallets that don't support switching
 */
export async function switchWalletChain(
  wallet: any,
  targetChainId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await wallet.switchChain(targetChainId);
    return { success: true };
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    console.warn(`Wallet chain switch warning: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Wait for state propagation after chain switch
 */
export async function waitForChainPropagation(ms: number = 300): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Verify chain consistency before transaction
 */
export function verifyChainConsistency(
  currentChainId: number,
  targetChainId: number,
  context: string
): { consistent: boolean; warning?: string } {
  if (currentChainId !== targetChainId) {
    const currentChain = getChainConfig(currentChainId);
    const targetChain = getChainConfig(targetChainId);

    return {
      consistent: false,
      warning: `${context}: Chain mismatch detected (current: ${currentChain?.name || currentChainId}, target: ${targetChain?.name || targetChainId})`
    };
  }

  return { consistent: true };
}
