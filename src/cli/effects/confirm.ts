// Confirmation effects - create overlay prompts
import type { StepDef } from "../state/types";
import { formatEther } from "viem";

export const confirmOverlayFx: StepDef["onEnter"] = (ctx, core, dispatch, signal) => {
  if (signal.aborted) return;

  if (!ctx.norm) {
    dispatch({
      type: "CONFIRM.NO",
    });
    return;
  }

  const amount = formatEther(ctx.norm.amountWei);
  const to = ctx.norm.to;
  const chainName = getChainName(core.chainId);

  const message = `Send ${amount} ETH to ${shortenAddress(to)} on ${chainName}?`;

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