// cli/effects/transfer/normalize.ts - Transfer-specific normalization effect

import type { StepDef } from "../../state/types";
import { normalizeTransferIntent } from "@/lib/transfer/normalize";
import { TransferTokenSelectionError } from "@/lib/transfer/errors";
import {
  requestChainSwitch,
  switchWalletChain,
  waitForChainPropagation
} from "@/lib/chain-utils";
import { resolveChain, getChainConfig } from "@/lib/chains/registry";

export const transferNormalizeFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  console.log("🔄 [Transfer Effect] Starting normalization");

  if (!ctx.intent) {
    dispatch({
      type: "NORMALIZE.FAIL",
      error: {
        code: "MISSING_INTENT",
        message: "No intent to normalize",
        phase: "normalize",
      },
    });
    return;
  }

  // Validate this is actually a transfer intent
  if (ctx.intent.action !== "transfer") {
    dispatch({
      type: "NORMALIZE.FAIL",
      error: {
        code: "INVALID_ACTION",
        message: `Expected transfer action, got ${ctx.intent.action}`,
        phase: "normalize",
      },
    });
    return;
  }

  // ============================================================================
  // CHAIN SWITCH LOGIC - Must happen before normalization
  // ============================================================================
  
  let targetChainId: number;
  let targetChainName: string;
  
  try {
    const transferIntent = ctx.intent as any;
    const chainConfig = resolveChain(transferIntent.chain);
    targetChainId = chainConfig.id;
    targetChainName = chainConfig.name;
  } catch (error) {
    dispatch({
      type: "NORMALIZE.FAIL",
      error: {
        code: "INVALID_CHAIN",
        message: "Cannot determine target chain for transfer",
        detail: error,
        phase: "normalize",
      },
    });
    return;
  }

  // Check if chain switch is needed
  const needsChainSwitch = core.chainId !== targetChainId;
  const alreadySwitched = ctx.chainSwitched === true;

  if (needsChainSwitch && !alreadySwitched) {
    const currentChain = getChainConfig(core.chainId);
    const targetChainConfig = getChainConfig(targetChainId);

    if (!targetChainConfig) {
      dispatch({
        type: "NORMALIZE.FAIL",
        error: {
          code: "CHAIN_CONFIG_MISSING",
          message: `Chain configuration not found for chain ${targetChainId}`,
          phase: "normalize",
        },
      });
      return;
    }

    console.log(`🔄 [Transfer Effect] Chain switch required: ${currentChain?.name || core.chainId} → ${targetChainName}`);

    // Notify user about chain switch
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: `🔄 Switching to ${targetChainName}...`,
        timestamp: Date.now(),
      },
    });

    try {
      // 1. Request UI chain switch
      const switchSuccess = await requestChainSwitch(targetChainId);
      if (!switchSuccess) {
        throw new Error("Chain switch was not completed");
      }

      // 2. Switch wallet chain for EOA mode (best effort)
      const accountMode = core.accountMode || "EOA";
      if (accountMode === "EOA" && core.selectedWallet) {
        await switchWalletChain(core.selectedWallet, targetChainId);
      }

      // 3. Wait for state propagation
      await waitForChainPropagation();

      // 4. Mark as switched (prevent duplicate switches)
      ctx.chainSwitched = true;

      console.log(`✅ [Transfer Effect] Chain switched to ${targetChainName}`);

      // Notify user about successful switch
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `✅ Switched to ${targetChainName}`,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      console.error("[Transfer Effect] Chain switch failed:", error);
      dispatch({
        type: "NORMALIZE.FAIL",
        error: {
          code: "CHAIN_SWITCH_FAILED",
          message: `Failed to switch to ${targetChainName}. Please switch manually and try again.`,
          detail: error,
          phase: "normalize",
        },
      });
      return;
    }
  } else if (needsChainSwitch && alreadySwitched) {
    console.log(`✅ [Transfer Effect] Chain switch already completed in this flow`);
  } else {
    console.log(`✅ [Transfer Effect] Already on correct chain: ${targetChainId}`);
  }

  // ============================================================================
  // END: CHAIN SWITCH LOGIC
  // ============================================================================

  try {
    console.log("🔄 [Transfer Effect] Normalizing transfer intent:", ctx.intent);

    // Use isolated transfer normalization (no preferredChainId!)
    const norm = await normalizeTransferIntent(ctx.intent as any);

    if (signal.aborted) return;

    console.log("✅ [Transfer Effect] Transfer normalized:", norm);
    dispatch({
      type: "NORMALIZE.OK",
      norm,
    });
  } catch (error: any) {
    if (signal.aborted) return;

    console.error("[Transfer Effect] Normalization error:", error);

    // Handle token selection error
    if (error instanceof TransferTokenSelectionError) {
      dispatch({
        type: "INTENT.TOKEN_SELECTION",
        tokenSelection: {
          message: error.message,
          tokens: error.tokens.map((token) => ({
            id: token.id,
            chainId: token.chainId,
            address: token.address,
            name: token.name,
            symbol: token.symbol,
            logoURI: token.logoURI || undefined,
            verified: token.verified || false,
          })),
        },
      });
      return;
    }

    // Handle other normalization errors
    dispatch({
      type: "NORMALIZE.FAIL",
      error: {
        code: error.code || "NORMALIZE_ERROR",
        message: error.message || "Failed to normalize transfer details",
        detail: error,
        phase: "normalize",
      },
    });
  }
};
