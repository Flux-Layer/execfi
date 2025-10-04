// Confirmation effects - create overlay prompts
import type { StepDef } from "../state/types";
import type { NormalizedTransfer } from "@/lib/transfer/types";
import { formatEther, formatUnits } from "viem";
import { getChainConfig } from "@/lib/chains/registry";
import { getTokenPriceUSD } from "@/services/priceService";
import { formatUSDValue } from "@/lib/utils";

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
  summary += `Chain: ${chainName} (Chain ID: ${norm.chainId})\n\n`;
  
  // Amount with USD value
  let tokenAmount: number;
  let tokenSymbol: string;
  
  if (norm.kind === "native-transfer") {
    tokenAmount = Number(norm.amountWei) / 1e18;
    tokenSymbol = "ETH";
  } else {
    tokenAmount = Number(norm.amountWei) / Math.pow(10, norm.token.decimals);
    tokenSymbol = norm.token.symbol;
  }
  
  summary += `Amount: ${tokenAmount} ${tokenSymbol}\n`;
  
  // Try to fetch USD value and calculate gas
  let usdValue = 0;
  let gasUsdCost = 0;
  let netUsdValue = 0;
  
  try {
    const price = await getTokenPriceUSD(tokenSymbol, norm.chainId);
    usdValue = tokenAmount * price;
    summary += `Value: ${formatUSDValue(usdValue, 'medium')} (at ${formatUSDValue(price, 'medium')}/${tokenSymbol})\n`;
  } catch (error) {
    console.warn("[Transfer Confirm] Could not fetch USD price:", error);
    summary += `Value: USD price unavailable\n`;
  }
  
  // Token contract (for ERC20)
  if (norm.kind === "erc20-transfer") {
    summary += `Token Contract: ${norm.token.address}\n`;
  }
  
  // Recipient
  summary += `\nRecipient: ${norm.to}\n`;
  
  // Gas estimate with USD cost
  if (ctx.sim?.gasEstimate) {
    const gasEstimate = ctx.sim.gasEstimate;
    summary += `\nEstimated Gas: ${gasEstimate.toString()} units`;
    
    // Try to calculate gas cost in USD
    try {
      // Estimate gas price (approximate, would need to fetch real gas price)
      const gasPrice = 2n; // 2 gwei approximate
      const gasCostWei = BigInt(gasEstimate) * gasPrice * 1_000_000_000n;
      const gasCostEth = Number(gasCostWei) / 1e18;
      const ethPrice = await getTokenPriceUSD("ETH", norm.chainId);
      gasUsdCost = gasCostEth * ethPrice;
      summary += ` (~${formatUSDValue(gasUsdCost, 'medium')})\n`;
    } catch (error) {
      summary += `\n`;
    }
  }
  
  // Net summary section
  if (usdValue > 0) {
    netUsdValue = usdValue - gasUsdCost;
    summary += "\n📊 NET SUMMARY:\n";
    summary += "─".repeat(50) + "\n";
    summary += `Gross Value:     ${formatUSDValue(usdValue, 'medium')}\n`;
    if (gasUsdCost > 0) {
      summary += `Gas Cost:      - ${formatUSDValue(gasUsdCost, 'medium')}\n`;
      summary += "─".repeat(50) + "\n";
      summary += `Net After Gas:   ${formatUSDValue(netUsdValue, 'medium')}\n`;
      
      // Warning if gas is high percentage
      const gasPercentage = (gasUsdCost / usdValue) * 100;
      if (gasPercentage > 20) {
        summary += `\n⚠️  Warning: Gas is ${gasPercentage.toFixed(1)}% of transaction value\n`;
      }
    }
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

/**
 * Show swap confirmation UI to user
 */
export const confirmSwapFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  console.log("💬 [Swap Confirm] Showing confirmation UI");

  if (!ctx.norm) {
    console.warn("[Swap Confirm] No normalized data");
    dispatch({ type: "CONFIRM.YES" });
    return;
  }

  try {
    const norm = ctx.norm as any;
    const chainConfig = getChainConfig(norm.fromChainId || norm.chainId);
    const chainName = chainConfig?.name || `Chain ${norm.fromChainId || norm.chainId}`;
    const chainId = norm.fromChainId || norm.chainId;

    let summary = "📝 Transaction Summary\n";
    summary += "─".repeat(50) + "\n\n";
    summary += `Type: Token Swap\n`;
    summary += `Chain: ${chainName} (Chain ID: ${chainId})\n\n`;
    
    // Format from amount (it's a BigInt in smallest unit)
    const fromAmountFormatted = formatUnits(norm.fromAmount || 0n, norm.fromToken?.decimals || 18);
    const fromAmount = parseFloat(fromAmountFormatted);
    const fromSymbol = norm.fromToken?.symbol || "tokens";
    
    // Get to amount from plan/route (only available after planning)
    let toAmount = 0;
    const toSymbol = norm.toToken?.symbol || "tokens";
    if (ctx.plan?.route?.toAmount && norm.toToken?.decimals) {
      const formattedToAmount = formatUnits(BigInt(ctx.plan.route.toAmount), norm.toToken.decimals);
      toAmount = parseFloat(formattedToAmount);
    }
    
    summary += `From: ${fromAmount} ${fromSymbol}\n`;
    
    // Try to fetch USD values
    let fromUsdValue = 0;
    let toUsdValue = 0;
    let gasUsdCost = 0;
    
    try {
      const fromPrice = await getTokenPriceUSD(fromSymbol, chainId);
      fromUsdValue = fromAmount * fromPrice;
      summary += `From Value: ${formatUSDValue(fromUsdValue, 'medium')}\n`;
    } catch (error) {
      console.warn("[Swap Confirm] Could not fetch from token USD price");
    }
    
    summary += `\nTo: ~${toAmount} ${toSymbol}\n`;
    
    try {
      const toPrice = await getTokenPriceUSD(toSymbol, chainId);
      toUsdValue = toAmount * toPrice;
      summary += `To Value: ~${formatUSDValue(toUsdValue, 'medium')}\n`;
    } catch (error) {
      console.warn("[Swap Confirm] Could not fetch to token USD price");
    }
    
    // Add rate if both amounts are available
    if (fromAmount && toAmount) {
      const rate = toAmount / fromAmount;
      summary += `\nRate: 1 ${fromSymbol} = ${rate.toFixed(6)} ${toSymbol}\n`;
    }
    
    // Add slippage info if available
    if (ctx.plan?.route?.steps?.[0]?.estimate) {
      const estimate = ctx.plan.route.steps[0].estimate;
      if (estimate.approvalAddress) {
        summary += `\nNote: Token approval may be required\n`;
      }
      if (estimate.gasCosts) {
        const gasCosts = estimate.gasCosts[0];
        if (gasCosts?.amountUSD) {
          gasUsdCost = parseFloat(gasCosts.amountUSD);
          summary += `Estimated Gas: ${formatUSDValue(gasUsdCost, 'medium')}\n`;
        }
      }
    }
    
    // Net summary section
    if (toUsdValue > 0 && fromUsdValue > 0) {
      const netUsdValue = toUsdValue - gasUsdCost;
      const profitLoss = netUsdValue - fromUsdValue;
      
      summary += "\n📊 NET SUMMARY:\n";
      summary += "─".repeat(50) + "\n";
      summary += `You're Spending: ${formatUSDValue(fromUsdValue, 'medium')}\n`;
      summary += `You'll Receive:  ~${formatUSDValue(toUsdValue, 'medium')} (gross)\n`;
      if (gasUsdCost > 0) {
        summary += `Gas Cost:      - ${formatUSDValue(gasUsdCost, 'medium')}\n`;
        summary += "─".repeat(50) + "\n";
        summary += `Net After Gas:   ~${formatUSDValue(netUsdValue, 'medium')}\n`;
        summary += `Net Profit/Loss: ${profitLoss >= 0 ? '+' : ''}${formatUSDValue(Math.abs(profitLoss), 'medium')} ${profitLoss >= 0 ? '✅' : '⚠️'}\n`;
        
        // Warning if gas is high percentage or unprofitable
        const gasPercentage = (gasUsdCost / toUsdValue) * 100;
        if (profitLoss < 0) {
          summary += `\n⚠️  Warning: This swap will result in a net loss of ${formatUSDValue(Math.abs(profitLoss), 'medium')}\n`;
        } else if (gasPercentage > 20) {
          summary += `\n⚠️  Warning: Gas is ${gasPercentage.toFixed(1)}% of received value\n`;
        }
      }
    }
    
    summary += "\n" + "─".repeat(50);

    dispatch({ type: "CHAT.ADD", message: { role: "assistant", content: summary, timestamp: Date.now() }});
    dispatch({ type: "CHAT.ADD", message: { role: "assistant", content: "✅ Type 'yes' or press Enter to confirm\n❌ Type 'no' or 'cancel' to abort", timestamp: Date.now() }});
    console.log("✅ [Swap Confirm] Confirmation UI displayed");
  } catch (error: any) {
    console.error("[Swap Confirm] Error:", error);
    dispatch({ type: "CONFIRM.YES" });
  }
};

/**
 * Show bridge confirmation UI to user
 */
export const confirmBridgeFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  console.log("💬 [Bridge Confirm] Showing confirmation UI");

  if (!ctx.norm) {
    console.warn("[Bridge Confirm] No normalized data");
    dispatch({ type: "CONFIRM.YES" });
    return;
  }

  try {
    const norm = ctx.norm as any;
    const fromChainConfig = getChainConfig(norm.fromChainId);
    const toChainConfig = getChainConfig(norm.toChainId);
    const fromChainName = fromChainConfig?.name || `Chain ${norm.fromChainId}`;
    const toChainName = toChainConfig?.name || `Chain ${norm.toChainId}`;

    let summary = "📝 Transaction Summary\n";
    summary += "─".repeat(50) + "\n\n";
    summary += `Type: Bridge Transfer\n`;
    summary += `From Chain: ${fromChainName} (Chain ID: ${norm.fromChainId})\n`;
    summary += `To Chain: ${toChainName} (Chain ID: ${norm.toChainId})\n\n`;
    
    // Format amount (it's a BigInt in smallest unit)
    const amountFormatted = formatUnits(norm.amount || 0n, norm.token?.decimals || 18);
    const amount = parseFloat(amountFormatted);
    const tokenSymbol = norm.token?.symbol || "tokens";
    
    summary += `Amount: ${amount} ${tokenSymbol}\n`;
    
    // Try to fetch USD value
    let usdValue = 0;
    let gasUsdCost = 0;
    
    try {
      const price = await getTokenPriceUSD(tokenSymbol, norm.fromChainId);
      usdValue = amount * price;
      summary += `Value: ${formatUSDValue(usdValue, 'medium')}\n`;
    } catch (error) {
      console.warn("[Bridge Confirm] Could not fetch USD price");
    }
    
    // Add bridge info if available
    if (ctx.plan?.route) {
      const route = ctx.plan.route;
      if (route.steps?.[0]?.toolDetails?.name) {
        summary += `\nBridge Provider: ${route.steps[0].toolDetails.name}\n`;
      }
      if (route.steps?.[0]?.estimate?.executionDuration) {
        const durationSeconds = route.steps[0].estimate.executionDuration;
        const minutes = Math.ceil(durationSeconds / 60);
        summary += `Estimated Time: ~${minutes} minute${minutes !== 1 ? 's' : ''}\n`;
      }
      if (route.steps?.[0]?.estimate?.gasCosts) {
        const gasCosts = route.steps[0].estimate.gasCosts[0];
        if (gasCosts?.amountUSD) {
          gasUsdCost = parseFloat(gasCosts.amountUSD);
          summary += `Estimated Gas: ${formatUSDValue(gasUsdCost, 'medium')}\n`;
        }
      }
    }
    
    // Net summary section
    if (usdValue > 0) {
      const netUsdValue = usdValue - gasUsdCost;
      const netTokenAmount = amount * (netUsdValue / usdValue);
      
      summary += "\n📊 NET SUMMARY:\n";
      summary += "─".repeat(50) + "\n";
      summary += `Gross Value:     ${formatUSDValue(usdValue, 'medium')}\n`;
      if (gasUsdCost > 0) {
        summary += `Gas Cost:      - ${formatUSDValue(gasUsdCost, 'medium')}\n`;
        summary += "─".repeat(50) + "\n";
        summary += `Net After Gas:   ${formatUSDValue(netUsdValue, 'medium')}\n`;
        summary += `You'll Receive:  ~${netTokenAmount.toFixed(6)} ${tokenSymbol} on ${toChainName}\n`;
        
        // Warning if gas is high percentage
        const gasPercentage = (gasUsdCost / usdValue) * 100;
        if (gasPercentage > 20) {
          summary += `\n⚠️  Warning: Gas is ${gasPercentage.toFixed(1)}% of bridge value\n`;
        }
      }
    }
    
    summary += "\n" + "─".repeat(50);

    dispatch({ type: "CHAT.ADD", message: { role: "assistant", content: summary, timestamp: Date.now() }});
    dispatch({ type: "CHAT.ADD", message: { role: "assistant", content: "✅ Type 'yes' or press Enter to confirm\n❌ Type 'no' or 'cancel' to abort", timestamp: Date.now() }});
    console.log("✅ [Bridge Confirm] Confirmation UI displayed");
  } catch (error: any) {
    console.error("[Bridge Confirm] Error:", error);
    dispatch({ type: "CONFIRM.YES" });
  }
};

/**
 * Show bridge-swap confirmation UI to user
 */
export const confirmBridgeSwapFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  console.log("💬 [Bridge-Swap Confirm] Showing confirmation UI");

  if (!ctx.norm) {
    console.warn("[Bridge-Swap Confirm] No normalized data");
    dispatch({ type: "CONFIRM.YES" });
    return;
  }

  try {
    const norm = ctx.norm as any;
    const fromChainConfig = getChainConfig(norm.fromChainId);
    const toChainConfig = getChainConfig(norm.toChainId);
    const fromChainName = fromChainConfig?.name || `Chain ${norm.fromChainId}`;
    const toChainName = toChainConfig?.name || `Chain ${norm.toChainId}`;

    let summary = "📝 Transaction Summary\n";
    summary += "─".repeat(50) + "\n\n";
    summary += `Type: Bridge + Swap\n`;
    summary += `From Chain: ${fromChainName} (Chain ID: ${norm.fromChainId})\n`;
    summary += `To Chain: ${toChainName} (Chain ID: ${norm.toChainId})\n\n`;
    
    // Format from amount (it's a BigInt in smallest unit)
    const fromAmountFormatted = formatUnits(norm.fromAmount || 0n, norm.fromToken?.decimals || 18);
    const fromAmount = parseFloat(fromAmountFormatted);
    const fromSymbol = norm.fromToken?.symbol || "tokens";
    
    // Get to amount from plan/route (only available after planning)
    let toAmount = 0;
    const toSymbol = norm.toToken?.symbol || "tokens";
    if (ctx.plan?.route?.toAmount && norm.toToken?.decimals) {
      toAmount = parseFloat(formatUnits(BigInt(ctx.plan.route.toAmount), norm.toToken.decimals));
    }
    
    summary += `From Token: ${fromAmount} ${fromSymbol}\n`;
    
    // Try to fetch USD values
    let fromUsdValue = 0;
    let toUsdValue = 0;
    let gasUsdCost = 0;
    
    try {
      const fromPrice = await getTokenPriceUSD(fromSymbol, norm.fromChainId);
      fromUsdValue = fromAmount * fromPrice;
      summary += `From Value: ${formatUSDValue(fromUsdValue, 'medium')}\n`;
    } catch (error) {
      console.warn("[Bridge-Swap Confirm] Could not fetch from token USD price");
    }
    
    summary += `\nTo Token: ~${toAmount} ${toSymbol}\n`;
    
    try {
      const toPrice = await getTokenPriceUSD(toSymbol, norm.toChainId);
      toUsdValue = toAmount * toPrice;
      summary += `To Value: ~${formatUSDValue(toUsdValue, 'medium')}\n`;
    } catch (error) {
      console.warn("[Bridge-Swap Confirm] Could not fetch to token USD price");
    }
    
    // Add route info if available
    if (ctx.plan?.route) {
      const route = ctx.plan.route;
      const steps = route.steps || [];
      
      if (steps.length > 0) {
        summary += `\nSteps: ${steps.length} step${steps.length !== 1 ? 's' : ''}\n`;
      }
      
      // Estimated time
      if (route.steps?.[0]?.estimate?.executionDuration) {
        const durationSeconds = route.steps[0].estimate.executionDuration;
        const minutes = Math.ceil(durationSeconds / 60);
        summary += `Estimated Time: ~${minutes} minute${minutes !== 1 ? 's' : ''}\n`;
      }
      
      // Gas costs
      if (route.gasCostUSD) {
        gasUsdCost = parseFloat(route.gasCostUSD);
        summary += `Estimated Gas: ${formatUSDValue(gasUsdCost, 'medium')}\n`;
      }
    }
    
    // Net summary section
    if (toUsdValue > 0 && fromUsdValue > 0) {
      const netUsdValue = toUsdValue - gasUsdCost;
      const profitLoss = netUsdValue - fromUsdValue;
      const netTokenAmount = toAmount * (netUsdValue / toUsdValue);
      
      summary += "\n📊 NET SUMMARY:\n";
      summary += "─".repeat(50) + "\n";
      summary += `You're Spending: ${formatUSDValue(fromUsdValue, 'medium')} (${fromSymbol} on ${fromChainName})\n`;
      summary += `You'll Receive:  ~${formatUSDValue(toUsdValue, 'medium')} (gross, ${toSymbol} on ${toChainName})\n`;
      if (gasUsdCost > 0) {
        summary += `Gas Cost:      - ${formatUSDValue(gasUsdCost, 'medium')}\n`;
        summary += "─".repeat(50) + "\n";
        summary += `Net After Gas:   ~${formatUSDValue(netUsdValue, 'medium')}\n`;
        summary += `Final Amount:    ~${netTokenAmount.toFixed(6)} ${toSymbol} on ${toChainName}\n`;
        summary += `Net Profit/Loss: ${profitLoss >= 0 ? '+' : ''}${formatUSDValue(Math.abs(profitLoss), 'medium')} ${profitLoss >= 0 ? '✅' : '⚠️'}\n`;
        
        // Warning if gas is high percentage or unprofitable
        const gasPercentage = (gasUsdCost / toUsdValue) * 100;
        if (profitLoss < 0) {
          summary += `\n⚠️  Warning: This bridge-swap will result in a net loss of ${formatUSDValue(Math.abs(profitLoss), 'medium')}\n`;
        } else if (gasPercentage > 20) {
          summary += `\n⚠️  Warning: Gas is ${gasPercentage.toFixed(1)}% of received value\n`;
        }
      }
    }
    
    summary += "\n" + "─".repeat(50);

    dispatch({ type: "CHAT.ADD", message: { role: "assistant", content: summary, timestamp: Date.now() }});
    dispatch({ type: "CHAT.ADD", message: { role: "assistant", content: "✅ Type 'yes' or press Enter to confirm\n❌ Type 'no' or 'cancel' to abort", timestamp: Date.now() }});
    console.log("✅ [Bridge-Swap Confirm] Confirmation UI displayed");
  } catch (error: any) {
    console.error("[Bridge-Swap Confirm] Error:", error);
    dispatch({ type: "CONFIRM.YES" });
  }
};