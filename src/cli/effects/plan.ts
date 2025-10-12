// Plan effects for swap/bridge operations using LI.FI
import type { StepDef } from "../state/types";
import type {
  NormalizedSwap,
  NormalizedBridge,
  NormalizedBridgeSwap,
} from "@/lib/normalize";
import { getChainConfig } from "@/lib/chains/registry";
import { formatUnits } from "viem";
import { getStepTransaction } from "@/lib/lifi-client";

/**
 * Plan swap operation - fetch LI.FI route for same-chain token exchange
 */
export const planSwapFx: StepDef["onEnter"] = async (
  ctx,
  core,
  dispatch,
  signal,
) => {
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
    // Get slippage: per-transaction override > user default > fallback
    const slippage = ctx.slippage ?? core.defaultSlippage ?? 0.005;

    console.log("🔄 Planning swap operation...", {
      fromToken: norm.fromToken.symbol,
      toToken: norm.toToken.symbol,
      amount: formatUnits(norm.fromAmount, norm.fromToken.decimals),
      chain: norm.fromChainId,
      slippage: `${(slippage * 100).toFixed(2)}%`,
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
          slippage: slippage,
          order: "RECOMMENDED",
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `LI.FI routes API error: ${response.status} ${errorText}`,
      );
    }

    const result = await response.json();

    if (
      !result.success ||
      !result.data?.baseRoutes ||
      result.data.baseRoutes.length === 0
    ) {
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

    // Validate that the route delivers the expected tokens
    if (
      route.fromToken.address.toLowerCase() !==
      norm.fromToken.address.toLowerCase()
    ) {
      console.warn(
        `⚠️ LI.FI route uses ${route.fromToken.symbol} instead of ${norm.fromToken.symbol}`,
      );
      dispatch({
        type: "OVERLAY.PUSH",
        overlay: {
          kind: "toast",
          level: "error",
          text: `Route mismatch: Cannot swap from ${norm.fromToken.symbol}. LI.FI can only swap from ${route.fromToken.symbol}.`,
          ttlMs: 5000,
        },
      });
      dispatch({
        type: "PLAN.FAIL",
        error: {
          code: "ROUTE_TOKEN_MISMATCH",
          message: `Cannot swap from ${norm.fromToken.symbol} - only ${route.fromToken.symbol} routes available`,
          phase: "plan",
        },
      });
      return;
    }

    if (
      route.toToken.address.toLowerCase() !== norm.toToken.address.toLowerCase()
    ) {
      console.warn(
        `⚠️ LI.FI route delivers ${route.toToken.symbol} instead of ${norm.toToken.symbol}`,
      );
      dispatch({
        type: "OVERLAY.PUSH",
        overlay: {
          kind: "toast",
          level: "error",
          text: `No routes available to swap to ${norm.toToken.symbol}. LI.FI can only swap to ${route.toToken.symbol}.`,
          ttlMs: 5000,
        },
      });
      dispatch({
        type: "PLAN.FAIL",
        error: {
          code: "ROUTE_TOKEN_MISMATCH",
          message: `Cannot swap to ${norm.toToken.symbol} - only ${route.toToken.symbol} routes available`,
          phase: "plan",
        },
      });
      return;
    }

    // 🔍 ENHANCED VALIDATION: Verify the actual final step delivers the expected token
    // LiFi sometimes returns routes where route.toToken claims one thing but actual steps do another
    const finalStep = route.steps[route.steps.length - 1];
    const actualFinalToken = finalStep?.action?.toToken;

    if (actualFinalToken) {
      const actualFinalTokenAddress = actualFinalToken.address.toLowerCase();
      const expectedToTokenAddress = norm.toToken.address.toLowerCase();

      if (actualFinalTokenAddress !== expectedToTokenAddress) {
        console.error(
          `❌ CRITICAL: LI.FI route metadata mismatch detected!`,
          `\n  Route claims to deliver: ${route.toToken.symbol} (${route.toToken.address})`,
          `\n  But final step actually delivers: ${actualFinalToken.symbol} (${actualFinalToken.address})`,
          `\n  Expected: ${norm.toToken.symbol} (${norm.toToken.address})`
        );

        dispatch({
          type: "OVERLAY.PUSH",
          overlay: {
            kind: "toast",
            level: "error",
            text: `Route validation failed: LI.FI cannot deliver ${norm.toToken.symbol}. The route would only deliver ${actualFinalToken.symbol}.`,
            ttlMs: 6000,
          },
        });

        dispatch({
          type: "PLAN.FAIL",
          error: {
            code: "ROUTE_FINAL_TOKEN_MISMATCH",
            message: `LI.FI route final step delivers ${actualFinalToken.symbol} instead of ${norm.toToken.symbol}. No valid routes available.`,
            phase: "plan",
          },
        });
        return;
      }

      console.log(`✅ Route validation passed: Final step delivers ${actualFinalToken.symbol} as expected`);
    } else {
      console.warn(`⚠️ Could not validate final step token - missing action data in route step`);
    }

    // 🔍 Multi-step route support
    if (route.steps.length > 1) {
      console.log(
        `ℹ️ Swap route has ${route.steps.length} steps. Will execute all steps sequentially.`,
        `\n  Steps:`,
        route.steps.map((step: any, idx: number) =>
          `\n    ${idx}: ${step.action.fromToken.symbol} → ${step.action.toToken.symbol}`
        ).join('')
      );
    }

    // Fetch transaction requests for ALL steps
    console.log(
      `🔄 Fetching transaction requests for all ${route.steps.length} steps...`,
    );

    for (let i = 0; i < route.steps.length; i++) {
      console.log(`   Fetching transaction request for step ${i}...`);
      const transactionRequest = await getStepTransaction({
        route,
        stepIndex: i,
        userAddress: norm.recipient,
      });

      route.steps[i].transactionRequest = transactionRequest;
      console.log(`   ✅ Step ${i} transaction request populated`);
    }

    console.log(`✅ All ${route.steps.length} steps populated with transaction requests`);

    // Extract route summary
    const fromChain = getChainConfig(norm.fromChainId);
    const toAmount = formatUnits(BigInt(route.toAmount), norm.toToken.decimals);
    const fromAmount = formatUnits(norm.fromAmount, norm.fromToken.decimals);
    const tools = route.steps.map((step: any) => step.tool).join(", ");
    const executionTime = route.steps.reduce(
      (sum: number, step: any) => sum + step.estimate.executionDuration,
      0,
    );

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
export const planBridgeFx: StepDef["onEnter"] = async (
  ctx,
  core,
  dispatch,
  signal,
) => {
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
    // Get slippage: per-transaction override > user default > fallback
    const slippage = ctx.slippage ?? core.defaultSlippage ?? 0.005;

    console.log("🔄 Planning bridge operation...", {
      token: norm.token.symbol,
      amount: formatUnits(norm.amount, norm.token.decimals),
      fromChain: norm.fromChainId,
      toChain: norm.toChainId,
      slippage: `${(slippage * 100).toFixed(2)}%`,
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
          slippage: slippage,
          order: "RECOMMENDED",
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `LI.FI routes API error: ${response.status} ${errorText}`,
      );
    }

    const result = await response.json();

    if (
      !result.success ||
      !result.data?.baseRoutes ||
      result.data.baseRoutes.length === 0
    ) {
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

    // Validate that the route delivers the expected token (should be same token for bridge)
    if (
      route.fromToken.address.toLowerCase() !== norm.token.address.toLowerCase()
    ) {
      console.warn(
        `⚠️ LI.FI bridge route uses ${route.fromToken.symbol} instead of ${norm.token.symbol}`,
      );
      dispatch({
        type: "OVERLAY.PUSH",
        overlay: {
          kind: "toast",
          level: "error",
          text: `Route mismatch: Cannot bridge ${norm.token.symbol}. LI.FI can only bridge ${route.fromToken.symbol}.`,
          ttlMs: 5000,
        },
      });
      dispatch({
        type: "PLAN.FAIL",
        error: {
          code: "ROUTE_TOKEN_MISMATCH",
          message: `Cannot bridge ${norm.token.symbol} - only ${route.fromToken.symbol} routes available`,
          phase: "plan",
        },
      });
      return;
    }

    if (
      route.toToken.address.toLowerCase() !== norm.token.address.toLowerCase()
    ) {
      console.warn(
        `⚠️ LI.FI bridge route delivers ${route.toToken.symbol} instead of ${norm.token.symbol}`,
      );
      dispatch({
        type: "OVERLAY.PUSH",
        overlay: {
          kind: "toast",
          level: "error",
          text: `No routes available to bridge to ${norm.token.symbol}. LI.FI can only bridge to ${route.toToken.symbol}.`,
          ttlMs: 5000,
        },
      });
      dispatch({
        type: "PLAN.FAIL",
        error: {
          code: "ROUTE_TOKEN_MISMATCH",
          message: `Cannot bridge to ${norm.token.symbol} - only ${route.toToken.symbol} routes available`,
          phase: "plan",
        },
      });
      return;
    }

    // 🔍 ENHANCED VALIDATION: Verify the actual final step delivers the expected token
    // LiFi sometimes returns routes where route.toToken claims one thing but actual steps do another
    const finalStep = route.steps[route.steps.length - 1];
    const actualFinalToken = finalStep?.action?.toToken;

    if (actualFinalToken) {
      const actualFinalTokenAddress = actualFinalToken.address.toLowerCase();
      const expectedToTokenAddress = norm.token.address.toLowerCase();

      if (actualFinalTokenAddress !== expectedToTokenAddress) {
        console.error(
          `❌ CRITICAL: LI.FI route metadata mismatch detected!`,
          `\n  Route claims to deliver: ${route.toToken.symbol} (${route.toToken.address})`,
          `\n  But final step actually delivers: ${actualFinalToken.symbol} (${actualFinalToken.address})`,
          `\n  Expected: ${norm.token.symbol} (${norm.token.address})`
        );

        dispatch({
          type: "OVERLAY.PUSH",
          overlay: {
            kind: "toast",
            level: "error",
            text: `Route validation failed: LI.FI cannot deliver ${norm.token.symbol} on destination chain. The route would only deliver ${actualFinalToken.symbol}.`,
            ttlMs: 6000,
          },
        });

        dispatch({
          type: "PLAN.FAIL",
          error: {
            code: "ROUTE_FINAL_TOKEN_MISMATCH",
            message: `LI.FI route final step delivers ${actualFinalToken.symbol} instead of ${norm.token.symbol}. No valid routes available.`,
            phase: "plan",
          },
        });
        return;
      }

      console.log(`✅ Route validation passed: Final step delivers ${actualFinalToken.symbol} as expected`);
    } else {
      console.warn(`⚠️ Could not validate final step token - missing action data in route step`);
    }

    // 🔍 Multi-step route support
    if (route.steps.length > 1) {
      console.log(
        `ℹ️ Bridge route has ${route.steps.length} steps. Will execute all steps sequentially.`,
        `\n  Steps:`,
        route.steps.map((step: any, idx: number) =>
          `\n    ${idx}: ${step.action.fromToken.symbol} on ${step.action.fromChainId} → ${step.action.toToken.symbol} on ${step.action.toChainId}`
        ).join('')
      );
    }

    // Fetch transaction requests for ALL steps
    console.log(
      `🔄 Fetching transaction requests for all ${route.steps.length} steps...`,
    );

    for (let i = 0; i < route.steps.length; i++) {
      console.log(`   Fetching transaction request for step ${i}...`);
      const transactionRequest = await getStepTransaction({
        route,
        stepIndex: i,
        userAddress: norm.recipient,
      });

      route.steps[i].transactionRequest = transactionRequest;
      console.log(`   ✅ Step ${i} transaction request populated`);
    }

    console.log(`✅ All ${route.steps.length} steps populated with transaction requests`);

    // Extract route summary
    const fromChain = getChainConfig(norm.fromChainId);
    const toChain = getChainConfig(norm.toChainId);
    const amount = formatUnits(norm.amount, norm.token.decimals);
    const bridges = route.steps
      .map((step: any) => step.tool)
      .filter((t: string, i: number, arr: string[]) => arr.indexOf(t) === i);
    const executionTime = route.steps.reduce(
      (sum: number, step: any) => sum + step.estimate.executionDuration,
      0,
    );

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
export const planBridgeSwapFx: StepDef["onEnter"] = async (
  ctx,
  core,
  dispatch,
  signal,
) => {
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
    // Get slippage: per-transaction override > user default > fallback
    const slippage = ctx.slippage ?? core.defaultSlippage ?? 0.005;

    console.log("🔄 Planning bridge-swap operation...", {
      fromToken: norm.fromToken.symbol,
      toToken: norm.toToken.symbol,
      amount: formatUnits(norm.fromAmount, norm.fromToken.decimals),
      fromChain: norm.fromChainId,
      toChain: norm.toChainId,
      slippage: `${(slippage * 100).toFixed(2)}%`,
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
          slippage: slippage,
          order: "RECOMMENDED",
          preferBridges: ["relay"],
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `LI.FI routes API error: ${response.status} ${errorText}`,
      );
    }

    const result = await response.json();

    if (
      !result.success ||
      !result.data?.baseRoutes ||
      result.data.baseRoutes.length === 0
    ) {
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
    const route =
      result.data.recommended ||
      result.data.baseRoutes[0];

    // 🐛 DEBUG: Log full route details to investigate token mismatch
    console.log(
      "📊 LI.FI Route - FROM TOKEN:",
      route.fromToken.symbol,
      route.fromToken.address,
    );
    console.log(
      "📊 LI.FI Route - TO TOKEN:",
      route.toToken.symbol,
      route.toToken.address,
    );
    console.log("📊 LI.FI Route - Steps:");
    route.steps.forEach((step: any, idx: number) => {
      console.log(`  Step ${idx}:`, step.type);
      console.log(
        `    From:`,
        step.action?.fromToken?.symbol,
        step.action?.fromToken?.address,
      );
      console.log(
        `    To:`,
        step.action?.toToken?.symbol,
        step.action?.toToken?.address,
      );
    });

    console.log(
      "🎯 Expected FROM TOKEN:",
      norm.fromToken.symbol,
      norm.fromToken.address,
    );
    console.log(
      "🎯 Expected TO TOKEN:",
      norm.toToken.symbol,
      norm.toToken.address,
    );

    // Validate that the route delivers the expected tokens
    if (
      route.fromToken.address.toLowerCase() !==
      norm.fromToken.address.toLowerCase()
    ) {
      console.warn(
        `⚠️ LI.FI bridge-swap route uses ${route.fromToken.symbol} instead of ${norm.fromToken.symbol}`,
      );
      dispatch({
        type: "OVERLAY.PUSH",
        overlay: {
          kind: "toast",
          level: "error",
          text: `Route mismatch: Cannot swap from ${norm.fromToken.symbol}. LI.FI can only swap from ${route.fromToken.symbol}.`,
          ttlMs: 5000,
        },
      });
      dispatch({
        type: "PLAN.FAIL",
        error: {
          code: "ROUTE_TOKEN_MISMATCH",
          message: `Cannot swap from ${norm.fromToken.symbol} - only ${route.fromToken.symbol} routes available`,
          phase: "plan",
        },
      });
      return;
    }

    if (
      route.toToken.address.toLowerCase() !== norm.toToken.address.toLowerCase()
    ) {
      console.warn(
        `⚠️ LI.FI bridge-swap route delivers ${route.toToken.symbol} instead of ${norm.toToken.symbol}`,
      );
      dispatch({
        type: "OVERLAY.PUSH",
        overlay: {
          kind: "toast",
          level: "error",
          text: `No routes available to swap to ${norm.toToken.symbol}. LI.FI can only bridge-swap to ${route.toToken.symbol}.`,
          ttlMs: 5000,
        },
      });
      dispatch({
        type: "PLAN.FAIL",
        error: {
          code: "ROUTE_TOKEN_MISMATCH",
          message: `Cannot swap to ${norm.toToken.symbol} - only ${route.toToken.symbol} routes available`,
          phase: "plan",
        },
      });
      return;
    }

    // 🔍 ENHANCED VALIDATION: Verify the actual final step delivers the expected token
    // LiFi sometimes returns routes where route.toToken claims one thing but actual steps do another
    const finalStep = route.steps[route.steps.length - 1];
    const actualFinalToken = finalStep?.action?.toToken;

    if (actualFinalToken) {
      const actualFinalTokenAddress = actualFinalToken.address.toLowerCase();
      const expectedToTokenAddress = norm.toToken.address.toLowerCase();

      if (actualFinalTokenAddress !== expectedToTokenAddress) {
        console.error(
          `❌ CRITICAL: LI.FI route metadata mismatch detected!`,
          `\n  Route claims to deliver: ${route.toToken.symbol} (${route.toToken.address})`,
          `\n  But final step actually delivers: ${actualFinalToken.symbol} (${actualFinalToken.address})`,
          `\n  Expected: ${norm.toToken.symbol} (${norm.toToken.address})`
        );

        dispatch({
          type: "OVERLAY.PUSH",
          overlay: {
            kind: "toast",
            level: "error",
            text: `Route validation failed: LI.FI cannot deliver ${norm.toToken.symbol} on ${norm.toChainId}. The route would only deliver ${actualFinalToken.symbol}.`,
            ttlMs: 6000,
          },
        });

        dispatch({
          type: "PLAN.FAIL",
          error: {
            code: "ROUTE_FINAL_TOKEN_MISMATCH",
            message: `LI.FI route final step delivers ${actualFinalToken.symbol} instead of ${norm.toToken.symbol}. No valid routes available.`,
            phase: "plan",
          },
        });
        return;
      }

      console.log(`✅ Route validation passed: Final step delivers ${actualFinalToken.symbol} as expected`);
    } else {
      console.warn(`⚠️ Could not validate final step token - missing action data in route step`);
    }

    // 🔍 Multi-step route support
    // The executeBridgeSwap function now handles multi-step routes by executing each step sequentially
    // and handling chain switching between steps automatically.
    if (route.steps.length > 1) {
      console.log(
        `ℹ️ Route has ${route.steps.length} steps. Will execute all steps sequentially.`,
        `\n  Steps:`,
        route.steps.map((step: any, idx: number) =>
          `\n    ${idx}: ${step.action.fromToken.symbol} on ${step.action.fromChainId} → ${step.action.toToken.symbol} on ${step.action.toChainId}`
        ).join('')
      );
    }

    // Fetch transaction requests for ALL steps
    console.log(
      `🔄 Fetching transaction requests for all ${route.steps.length} steps...`,
    );

    for (let i = 0; i < route.steps.length; i++) {
      console.log(`   Fetching transaction request for step ${i}...`);
      const transactionRequest = await getStepTransaction({
        route,
        stepIndex: i,
        userAddress: norm.recipient,
      });

      route.steps[i].transactionRequest = transactionRequest;
      console.log(`   ✅ Step ${i} transaction request populated`);
    }

    console.log(`✅ All ${route.steps.length} steps populated with transaction requests`);

    // Extract route summary
    const fromChain = getChainConfig(norm.fromChainId);
    const toChain = getChainConfig(norm.toChainId);
    const toAmount = formatUnits(BigInt(route.toAmount), norm.toToken.decimals);
    const fromAmount = formatUnits(norm.fromAmount, norm.fromToken.decimals);
    const steps = route.steps.length;
    const executionTime = route.steps.reduce(
      (sum: number, step: any) => sum + step.estimate.executionDuration,
      0,
    );

    // Add success message
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: `📋 Bridge-swap plan ready:\n• ${fromChain?.name} ${norm.fromToken.symbol} → ${toChain?.name} ${norm.toToken.symbol}\n• From: ${fromAmount} ${norm.fromToken.symbol}\n• To: ~${toAmount} ${norm.toToken.symbol}\n• Via: ${steps} step${steps > 1 ? "s" : ""}\n• ETA: ${executionTime}s`,
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

/**
 * Skip plan step for simple transfers that don't need route planning
 * Dispatches PLAN.OK to transition to next step
 */
export const skipPlanFx: StepDef["onEnter"] = (ctx, core, dispatch, signal) => {
  if (signal.aborted) return;

  console.log(
    "⏭️ Skipping plan step (native transfer - no route planning needed)",
  );

  setTimeout(() => {
    if (!signal.aborted) {
      dispatch({
        type: "PLAN.OK",
        plan: {
          skipped: true,
          reason: "Native transfer does not require route planning",
        },
      });
    }
  }, 0);
};
