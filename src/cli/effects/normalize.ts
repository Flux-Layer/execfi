// Normalize effects using existing orchestrator logic
import type { StepDef } from "../state/types";
import { normalizeIntent, TokenSelectionError } from "@/lib/normalize";
import { DeFiTokenSelectionError } from "@/lib/defi/errors";
import {
  verifyChainConsistency,
  requestChainSwitch,
  switchWalletChain,
  waitForChainPropagation
} from "@/lib/chain-utils";
import { resolveChain, getChainConfig } from "@/lib/chains/registry";
import { transferNormalizeFx } from "./transfer/normalize";

export const normalizeFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  // Route transfers to isolated transfer effect
  if (ctx.intent?.action === "transfer") {
    console.log("🔀 [Main Effect] Routing to isolated transfer normalization");
    if (transferNormalizeFx) {
      return await transferNormalizeFx(ctx, core, dispatch, signal);
    }
  }
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

  // ============================================================================
  // CHAIN SWITCHING (for swap/bridge/bridge_swap)
  // ============================================================================

  let requiredChainId: number | undefined;
  let requiredChainName: string | undefined;

  try {
    if (ctx.intent.action === 'swap') {
      const swapIntent = ctx.intent as any;
      const fromChainConfig = resolveChain(swapIntent.fromChain);
      requiredChainId = fromChainConfig.id;
      requiredChainName = fromChainConfig.name;
    } else if (ctx.intent.action === 'bridge' || ctx.intent.action === 'bridge_swap') {
      const bridgeIntent = ctx.intent as any;
      const fromChainConfig = resolveChain(bridgeIntent.fromChain);
      requiredChainId = fromChainConfig.id;
      requiredChainName = fromChainConfig.name;
    } else if (ctx.intent.action === 'transfer') {
      const transferIntent = ctx.intent as any;
      const chainConfig = resolveChain(transferIntent.chain);
      requiredChainId = chainConfig.id;
      requiredChainName = chainConfig.name;
    }
  } catch (error) {
    console.warn("Could not determine required chain during normalization:", error);
  }

  // Check if chain switch is needed
  const needsChainSwitch = requiredChainId && requiredChainId !== core.chainId;
  const alreadySwitched = ctx.chainSwitched === true;

  if (needsChainSwitch && !alreadySwitched && requiredChainId) {
    const currentChain = getChainConfig(core.chainId);
    const targetChainConfig = getChainConfig(requiredChainId);

    console.log(`🔄 [Normalize Effect] Chain switch required: ${currentChain?.name || core.chainId} → ${requiredChainName}`);

    // Notify user about chain switch
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: `🔄 Switching to ${requiredChainName}...`,
        timestamp: Date.now(),
      },
    });

    try {
      // 1. Request UI chain switch
      const switchSuccess = await requestChainSwitch(requiredChainId);
      if (!switchSuccess) {
        throw new Error("Chain switch was not completed");
      }

      // 2. Switch wallet chain for EOA mode (best effort)
      const accountMode = core.accountMode || "EOA";
      if (accountMode === "EOA" && core.selectedWallet) {
        await switchWalletChain(core.selectedWallet, requiredChainId);
      }

      // 3. Wait for state propagation
      await waitForChainPropagation();

      // 4. Mark as switched to prevent duplicate switches
      ctx.chainSwitched = true;

      console.log(`✅ [Normalize Effect] Chain switched to ${requiredChainName}`);

      // Notify user of successful switch
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `✅ Switched to ${requiredChainName}`,
          timestamp: Date.now(),
        },
      });
    } catch (error: any) {
      console.error("[Normalize Effect] Chain switch error:", error);

      dispatch({
        type: "NORMALIZE.FAIL",
        error: {
          code: "CHAIN_SWITCH_FAILED",
          message: `Failed to switch to ${requiredChainName}: ${error.message}`,
          phase: "normalize",
        },
      });
      return;
    }
  } else if (requiredChainId && requiredChainId === core.chainId) {
    console.log(`✅ [Normalize Effect] Already on correct chain: ${requiredChainId}`);
  }

  // ============================================================================
  // END: CHAIN SWITCHING
  // ============================================================================

  try {
    console.log("🔄 Normalizing intent:", ctx.intent);

    // Get sender address for swap/bridge operations
    const senderAddress = core.accountMode === "SMART_ACCOUNT"
      ? core.saAddress
      : core.selectedWallet?.address;

    const norm = await normalizeIntent(
      { ok: true, intent: ctx.intent },
      {
        preferredChainId: core.chainId,
        senderAddress: senderAddress as `0x${string}` | undefined
      }
    );

    if (signal.aborted) return;

    console.log("✅ Intent normalized:", norm);
    dispatch({
      type: "NORMALIZE.OK",
      norm,
    });
  } catch (error: any) {
    if (signal.aborted) return;

    console.error("Normalization error:", error);

    // Handle token selection errors (both generic and DeFi-specific)
    if (error instanceof TokenSelectionError || error instanceof DeFiTokenSelectionError) {
      console.log("🎯 Token selection required, dispatching INTENT.TOKEN_SELECTION");
      
      dispatch({
        type: "INTENT.TOKEN_SELECTION",
        tokenSelection: {
          message: error.message,
          tokens: error.tokens.map((token: any) => ({
            id: token.id,
            chainId: token.chainId,
            address: token.address,
            name: token.name,
            symbol: token.symbol,
            logoURI: token.logoURI,
            verified: token.verified,
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
        message: error.message || "Failed to normalize transaction details",
        detail: error,
        phase: "normalize",
      },
    });
  }
};
