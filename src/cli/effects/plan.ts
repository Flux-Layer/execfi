// Plan effects for swap/bridge operations using LI.FI
import type { StepDef } from "../state/types";
import type { NormalizedSwap, NormalizedBridge, NormalizedBridgeSwap } from "@/lib/normalize";
import { getChainConfig } from "@/lib/chains/registry";
import { formatUnits } from "viem";
import { getStepTransaction } from "@/lib/lifi-client";

/**
 * Plan swap operation - fetch LI.FI route for same-chain token exchange
 */
export const planSwapFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  console.log("🔍 planSwapFx called - Starting swap planning");
  if (!ctx.norm || ctx.norm.kind !== "swap") {
    console.log("❌ Invalid intent type for swap planning:", ctx.norm?.kind);
    dispatch({
      type: "PLAN.FAIL",
      error: {
        code: "INVALID_INTENT_TYPE",
        message: "Invalid normalized intent for swap planning",
        phase: "plan",
      },
    });
    return;
  }

  const norm = ctx.norm as NormalizedSwap;

  try {
    console.log("🔄 Planning swap operation...", {
      fromToken: norm.fromToken.symbol,
      toToken: norm.toToken.symbol,
      amount: formatUnits(norm.fromAmount, norm.fromToken.decimals),
      chain: norm.fromChainId,
    });

    // Call LI.FI routes API (POST expects nested structure with "route" key)
    const response = await fetch("/api/lifi/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        route: {
          fromChain: norm.fromChainId,
          toChain: norm.toChainId,
          fromToken: norm.fromToken.address,
          toToken: norm.toToken.address,
          fromAmount: norm.fromAmount.toString(),
          fromAddress: norm.recipient, // Use recipient as fromAddress
          toAddress: norm.recipient,
          slippage: 0.005, // 0.5% default slippage
          order: "RECOMMENDED",
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LI.FI routes API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    if (!result.success || !result.data?.baseRoutes || result.data.baseRoutes.length === 0) {
      dispatch({
        type: "OVERLAY.PUSH",
        overlay: {
          kind: "toast",
          level: "error",
          text: "No swap routes available for this token pair",
          ttlMs: 4000,
        },
      });
      dispatch({
        type: "PLAN.FAIL",
        error: {
          code: "NO_ROUTES_FOUND",
          message: "No routes found",
          phase: "plan",
        },
      });
      return;
    }

    // Pick the best route (recommended route from advanced API)
    const route = result.data.recommended || result.data.baseRoutes[0];

    // Fetch transaction request for the first step
    console.log("🔄 Fetching transaction request for route step 0...");
    const transactionRequest = await getStepTransaction({
      route,
      stepIndex: 0,
      userAddress: norm.recipient,
    });

    // Populate route with transaction request
    route.steps[0].transactionRequest = transactionRequest;
    console.log("✅ Route populated with transaction request");

    // Extract route summary
    const fromChain = getChainConfig(norm.fromChainId);
    const toAmount = formatUnits(BigInt(route.toAmount), norm.toToken.decimals);
    const fromAmount = formatUnits(norm.fromAmount, norm.fromToken.decimals);
    const tools = route.steps.map((step: any) => step.tool).join(", ");
    const executionTime = route.steps.reduce((sum: number, step: any) => sum + step.estimate.executionDuration, 0);

    // Add success message
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: `📋 Swap plan ready:\n• From: ${fromAmount} ${norm.fromToken.symbol}\n• To: ~${toAmount} ${norm.toToken.symbol}\n• Chain: ${fromChain?.name}\n• Tools: ${tools}\n• ETA: ${executionTime}s`,
        timestamp: Date.now(),
      },
    });

    // Store route in context for execution
    const planData = {
      route,
      toAmountMin: route.toAmountMin,
    };
    console.log("✅ Dispatching PLAN.OK with route:", {
      hasRoute: !!planData.route,
      routeId: planData.route?.id,
      routeSteps: planData.route?.steps?.length,
    });
    dispatch({
      type: "PLAN.OK",
      plan: planData,
    });
  } catch (error: any) {
    console.error("Swap planning error:", error);

    dispatch({
      type: "OVERLAY.PUSH",
      overlay: {
        kind: "toast",
        level: "error",
        text: `Failed to plan swap: ${error.message}`,
        ttlMs: 4000,
      },
    });

    dispatch({
      type: "PLAN.FAIL",
      error: {
        code: "PLAN_ERROR",
        message: error.message || "Swap planning failed",
        phase: "plan",
      },
    });
  }
};

/**
 * Plan bridge operation - fetch LI.FI route for cross-chain transfer
 */
export const planBridgeFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  if (!ctx.norm || ctx.norm.kind !== "bridge") {
    dispatch({
      type: "PLAN.FAIL",
      error: {
        code: "INVALID_INTENT_TYPE",
        message: "Invalid normalized intent for bridge planning",
        phase: "plan",
      },
    });
    return;
  }

  const norm = ctx.norm as NormalizedBridge;

  try {
    console.log("🔄 Planning bridge operation...", {
      token: norm.token.symbol,
      amount: formatUnits(norm.amount, norm.token.decimals),
      fromChain: norm.fromChainId,
      toChain: norm.toChainId,
    });

    // Call LI.FI routes API (POST expects nested structure with "route" key)
    const response = await fetch("/api/lifi/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        route: {
          fromChain: norm.fromChainId,
          toChain: norm.toChainId,
          fromToken: norm.token.address,
          toToken: norm.token.address, // Same token on destination
          fromAmount: norm.amount.toString(),
          fromAddress: norm.recipient, // Assuming sender is recipient
          toAddress: norm.recipient,
          slippage: 0.005,
          order: "RECOMMENDED",
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LI.FI routes API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    if (!result.success || !result.data?.baseRoutes || result.data.baseRoutes.length === 0) {
      dispatch({
        type: "OVERLAY.PUSH",
        overlay: {
          kind: "toast",
          level: "error",
          text: "No bridge routes available for this chain pair",
          ttlMs: 4000,
        },
      });
      dispatch({
        type: "PLAN.FAIL",
        error: {
          code: "NO_ROUTES_FOUND",
          message: "No routes found",
          phase: "plan",
        },
      });
      return;
    }

    // Pick the best route (recommended route from advanced API)
    const route = result.data.recommended || result.data.baseRoutes[0];

    // Fetch transaction request for the first step
    console.log("🔄 Fetching transaction request for bridge route step 0...");
    const transactionRequest = await getStepTransaction({
      route,
      stepIndex: 0,
      userAddress: norm.recipient,
    });

    // Populate route with transaction request
    route.steps[0].transactionRequest = transactionRequest;
    console.log("✅ Bridge route populated with transaction request");

    // Extract route summary
    const fromChain = getChainConfig(norm.fromChainId);
    const toChain = getChainConfig(norm.toChainId);
    const amount = formatUnits(norm.amount, norm.token.decimals);
    const bridges = route.steps.map((step: any) => step.tool).filter((t: string, i: number, arr: string[]) => arr.indexOf(t) === i);
    const executionTime = route.steps.reduce((sum: number, step: any) => sum + step.estimate.executionDuration, 0);

    // Add success message
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: `📋 Bridge plan ready:\n• ${fromChain?.name} ${norm.token.symbol} → ${toChain?.name} ${norm.token.symbol}\n• Amount: ${amount} ${norm.token.symbol}\n• Via: ${bridges.join(", ")}\n• ETA: ${executionTime}s`,
        timestamp: Date.now(),
      },
    });

    // Store route in context for execution
    dispatch({
      type: "PLAN.OK",
      plan: {
        route,
        toAmountMin: route.toAmountMin,
      },
    });
  } catch (error: any) {
    console.error("Bridge planning error:", error);

    dispatch({
      type: "OVERLAY.PUSH",
      overlay: {
        kind: "toast",
        level: "error",
        text: `Failed to plan bridge: ${error.message}`,
        ttlMs: 4000,
      },
    });

    dispatch({
      type: "PLAN.FAIL",
      error: {
        code: "PLAN_ERROR",
        message: error.message || "Bridge planning failed",
        phase: "plan",
      },
    });
  }
};

/**
 * Plan bridge-swap operation - fetch LI.FI route for cross-chain token exchange
 */
export const planBridgeSwapFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  if (!ctx.norm || ctx.norm.kind !== "bridge-swap") {
    dispatch({
      type: "PLAN.FAIL",
      error: {
        code: "INVALID_INTENT_TYPE",
        message: "Invalid normalized intent for bridge-swap planning",
        phase: "plan",
      },
    });
    return;
  }

  const norm = ctx.norm as NormalizedBridgeSwap;

  try {
    console.log("🔄 Planning bridge-swap operation...", {
      fromToken: norm.fromToken.symbol,
      toToken: norm.toToken.symbol,
      amount: formatUnits(norm.fromAmount, norm.fromToken.decimals),
      fromChain: norm.fromChainId,
      toChain: norm.toChainId,
    });

    // Call LI.FI routes API (POST expects nested structure with "route" key)
    const response = await fetch("/api/lifi/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        route: {
          fromChain: norm.fromChainId,
          toChain: norm.toChainId,
          fromToken: norm.fromToken.address,
          toToken: norm.toToken.address,
          fromAmount: norm.fromAmount.toString(),
          fromAddress: norm.recipient, // Assuming sender is recipient
          toAddress: norm.recipient,
          slippage: 0.005,
          order: "RECOMMENDED",
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LI.FI routes API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    if (!result.success || !result.data?.baseRoutes || result.data.baseRoutes.length === 0) {
      dispatch({
        type: "OVERLAY.PUSH",
        overlay: {
          kind: "toast",
          level: "error",
          text: "No bridge-swap routes available for this token/chain combination",
          ttlMs: 4000,
        },
      });
      dispatch({
        type: "PLAN.FAIL",
        error: {
          code: "NO_ROUTES_FOUND",
          message: "No routes found",
          phase: "plan",
        },
      });
      return;
    }

    // Pick the best route (recommended route from advanced API)
    const route = result.data.recommended || result.data.baseRoutes[0];

    // Fetch transaction request for the first step
    console.log("🔄 Fetching transaction request for bridge-swap route step 0...");
    const transactionRequest = await getStepTransaction({
      route,
      stepIndex: 0,
      userAddress: norm.recipient,
    });

    // Populate route with transaction request
    route.steps[0].transactionRequest = transactionRequest;
    console.log("✅ Bridge-swap route populated with transaction request");

    // Extract route summary
    const fromChain = getChainConfig(norm.fromChainId);
    const toChain = getChainConfig(norm.toChainId);
    const toAmount = formatUnits(BigInt(route.toAmount), norm.toToken.decimals);
    const fromAmount = formatUnits(norm.fromAmount, norm.fromToken.decimals);
    const steps = route.steps.length;
    const executionTime = route.steps.reduce((sum: number, step: any) => sum + step.estimate.executionDuration, 0);

    // Add success message
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: `📋 Bridge-swap plan ready:\n• ${fromChain?.name} ${norm.fromToken.symbol} → ${toChain?.name} ${norm.toToken.symbol}\n• From: ${fromAmount} ${norm.fromToken.symbol}\n• To: ~${toAmount} ${norm.toToken.symbol}\n• Via: ${steps} step${steps > 1 ? 's' : ''}\n• ETA: ${executionTime}s`,
        timestamp: Date.now(),
      },
    });

    // Store route in context for execution
    dispatch({
      type: "PLAN.OK",
      plan: {
        route,
        toAmountMin: route.toAmountMin,
      },
    });
  } catch (error: any) {
    console.error("Bridge-swap planning error:", error);

    dispatch({
      type: "OVERLAY.PUSH",
      overlay: {
        kind: "toast",
        level: "error",
        text: `Failed to plan bridge-swap: ${error.message}`,
        ttlMs: 4000,
      },
    });

    dispatch({
      type: "PLAN.FAIL",
      error: {
        code: "PLAN_ERROR",
        message: error.message || "Bridge-swap planning failed",
        phase: "plan",
      },
    });
  }
};
