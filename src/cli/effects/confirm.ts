// Confirmation effects - create overlay prompts
import type { StepDef } from "../state/types";
import type { NormalizedTransfer } from "@/lib/transfer/types";
import { formatEther } from "viem";
import { getChainConfig } from "@/lib/chains/registry";

export const confirmOverlayFx: StepDef["onEnter"] = (ctx, core, dispatch, signal) => {
  if (signal.aborted) return;

  if (!ctx.norm) {
    dispatch({
      type: "CONFIRM.NO",
    });
    return;
  }

  // Build confirmation message based on intent type
  let message: string;
  const chainName = getChainName(core.chainId);

  if (ctx.norm.kind === "native-transfer") {
    const amount = formatEther(ctx.norm.amountWei);
    message = `Send ${amount} ETH to ${shortenAddress(ctx.norm.to)} on ${chainName}?`;
  } else if (ctx.norm.kind === "erc20-transfer") {
    const amount = formatEther(ctx.norm.amountWei);
    message = `Send ${amount} ${ctx.norm.token.symbol} to ${shortenAddress(ctx.norm.to)} on ${chainName}?`;
  } else if (ctx.norm.kind === "swap") {
    message = `Swap ${ctx.norm.fromToken.symbol} to ${ctx.norm.toToken.symbol} on ${chainName}?`;
  } else if (ctx.norm.kind === "bridge") {
    const fromChainName = getChainName(ctx.norm.fromChainId);
    const toChainName = getChainName(ctx.norm.toChainId);
    message = `Bridge ${ctx.norm.token.symbol} from ${fromChainName} to ${toChainName}?`;
  } else if (ctx.norm.kind === "bridge-swap") {
    const fromChainName = getChainName(ctx.norm.fromChainId);
    const toChainName = getChainName(ctx.norm.toChainId);
    message = `Bridge & swap ${ctx.norm.fromToken.symbol} on ${fromChainName} to ${ctx.norm.toToken.symbol} on ${toChainName}?`;
  } else {
    message = "Confirm transaction?";
  }

  console.log("🔄 Requesting confirmation:", message);

  dispatch({
    type: "OVERLAY.PUSH",
    overlay: {
      kind: "confirm",
      message,
      onYes: { type: "CONFIRM.YES" },
      onNo: { type: "CONFIRM.NO" },
    },
  });
};

export const clarifyToastFx: StepDef["onEnter"] = (ctx, core, dispatch, signal) => {
  if (signal.aborted) return;

  const message = ctx.error?.message || "Please provide more information";

  dispatch({
    type: "OVERLAY.PUSH",
    overlay: {
      kind: "toast",
      level: "warn",
      text: `❓ ${message}`,
      ttlMs: 10000, // Keep clarification messages longer
    },
  });

  // Also add to chat history for context
  dispatch({
    type: "CHAT.ADD",
    message: {
      role: "assistant",
      content: {
        type: "clarification",
        question: message,
        missing: ctx.error?.detail as string[] || [],
      },
      timestamp: Date.now(),
    },
  });
};

// Helper functions
function getChainName(chainId: number): string {
  switch (chainId) {
    case 1:
      return "Ethereum";
    case 8453:
      return "Base";
    case 84532:
      return "Base Sepolia";
    case 137:
      return "Polygon";
    case 42161:
      return "Arbitrum";
    case 10:
      return "Optimism";
    case 43114:
      return "Avalanche";
    default:
      return `Chain ${chainId}`;
  }
}

function shortenAddress(address?: `0x${string}`): string {
  if (!address) return "Unknown";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Show transfer confirmation UI to user
 * Displays transaction summary and prompts for yes/no confirmation
 */
export const confirmTransferFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  console.log("💬 [Transfer Confirm] Showing confirmation UI");

  if (!ctx.norm) {
    console.error("[Transfer Confirm] No normalized data to confirm");
    dispatch({
      type: "CONFIRM.NO",
    });
    return;
  }

  // Validate this is a transfer operation
  if (ctx.norm.kind !== "native-transfer" && ctx.norm.kind !== "erc20-transfer") {
    console.error(`[Transfer Confirm] Invalid operation type: ${ctx.norm.kind}`);
    dispatch({
      type: "CONFIRM.NO",
    });
    return;
  }

  const norm = ctx.norm as NormalizedTransfer;
  const chain = getChainConfig(norm.chainId);
  const chainName = chain?.name || `Chain ${norm.chainId}`;

  // Build transaction summary
  let summary = "📝 Transaction Summary\n";
  summary += "─".repeat(50) + "\n\n";
  
  // Transaction type
  summary += `Type: ${norm.kind === "native-transfer" ? "Native Transfer" : "Token Transfer"}\n`;
  
  // Chain
  summary += `Chain: ${chainName} (${norm.chainId})\n\n`;
  
  // Amount
  if (norm.kind === "native-transfer") {
    const ethAmount = Number(norm.amountWei) / 1e18;
    summary += `Amount: ${ethAmount} ETH\n`;
  } else {
    const tokenAmount = Number(norm.amountWei) / Math.pow(10, norm.token.decimals);
    summary += `Amount: ${tokenAmount} ${norm.token.symbol}\n`;
    summary += `Token: ${norm.token.address}\n`;
  }
  
  // Recipient
  summary += `\nRecipient: ${norm.to}\n`;
  
  // Gas estimate (if available)
  if (ctx.sim?.gasEstimate) {
    const gasEstimate = ctx.sim.gasEstimate;
    summary += `\nEstimated Gas: ${gasEstimate.toString()} units\n`;
  }
  
  summary += "\n" + "─".repeat(50);

  // Add summary to chat
  dispatch({
    type: "CHAT.ADD",
    message: {
      role: "assistant",
      content: summary,
      timestamp: Date.now(),
    },
  });

  // Add confirmation prompt
  dispatch({
    type: "CHAT.ADD",
    message: {
      role: "assistant",
      content: "✅ Type 'yes' or press Enter to confirm\n❌ Type 'no' or 'cancel' to abort",
      timestamp: Date.now(),
    },
  });

  console.log("✅ [Transfer Confirm] Confirmation UI displayed, waiting for user input");
};