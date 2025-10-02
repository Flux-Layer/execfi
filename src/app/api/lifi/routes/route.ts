// app/api/lifi/routes/route.ts - Route planning API endpoint

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRoutes, pickBestRoute, LifiError, type LifiRoute } from "@/lib/lifi-client";
import { type Route } from "@lifi/sdk";

// Request validation schema
const RouteRequestSchema = z.object({
  fromChain: z.number().int().positive(),
  toChain: z.number().int().positive(),
  fromToken: z.string().min(1),
  toToken: z.string().min(1),
  fromAmount: z.string().regex(/^\d+\.?\d*$/, "Amount must be a valid decimal number"),
  fromAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address"),
  toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address").optional(),
  slippage: z.number().min(0).max(1).default(0.005), // 0.5% default
  order: z.enum(["RECOMMENDED", "FASTEST", "CHEAPEST"]).default("RECOMMENDED"),
  allowBridges: z.array(z.string()).optional(),
  denyBridges: z.array(z.string()).optional(),
  maxPriceImpact: z.number().min(0).max(1).default(0.05), // 5% max price impact
});

// Response schema
const RouteResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    routes: z.array(z.any()), // Use the LifiRoute schema from client
    recommended: z.any().optional(), // Best route based on order preference
    alternatives: z.array(z.any()).optional(), // Alternative routes
    summary: z.object({
      totalRoutes: z.number(),
      fastestRoute: z.object({
        id: z.string(),
        duration: z.number(),
        durationFormatted: z.string(),
      }).optional(),
      cheapestRoute: z.object({
        id: z.string(),
        totalCost: z.string(),
        outputAmount: z.string(),
      }).optional(),
      priceImpact: z.object({
        percentage: z.number(),
        acceptable: z.boolean(),
      }).optional(),
    }),
    requestId: z.string(),
    timestamp: z.number(),
  }).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
});

export type RouteResponse = z.infer<typeof RouteResponseSchema>;

/**
 * Format duration in human-readable format
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

/**
 * Calculate price impact percentage
 */
function calculatePriceImpact(route: Route): number {
  const fromAmount = BigInt(route.fromAmount);
  const toAmount = BigInt(route.toAmount);

  // For same-chain transfers, price impact should be near 0
  if (route.fromChainId === route.toChainId && route.fromToken.address === route.toToken.address) {
    return 0;
  }

  // Simplified price impact calculation
  // In a real implementation, you'd need to fetch current market prices
  const expectedAmount = fromAmount; // Simplified: assume 1:1 for calculation
  const actualAmount = toAmount;

  if (expectedAmount === 0n) return 0;

  const impact = Number((expectedAmount - actualAmount) * 10000n / expectedAmount) / 100;
  return Math.max(0, impact);
}

/**
 * Analyze and enhance routes with additional metadata
 */
function analyzeRoutes(routes: Route[], maxPriceImpact: number) {
  const routeAnalysis = routes.map(route => {
    const totalDuration = route.steps.reduce((sum, step) => sum + step.estimate.executionDuration, 0);
    const priceImpact = calculatePriceImpact(route);
    const totalGasCost = route.steps.reduce((sum, step) => {
      const gasCosts = step.estimate.gasCosts || [];
      return sum + gasCosts.reduce((gasSum, gas) => gasSum + BigInt(gas.amount), 0n);
    }, 0n);

    return {
      route,
      analysis: {
        duration: totalDuration,
        priceImpact,
        totalGasCost: totalGasCost.toString(),
        acceptable: priceImpact <= maxPriceImpact,
        tools: route.steps.map(step => step.tool),
        bridgeCount: route.steps.filter(step => step.type?.includes("cross") || step.type?.includes("bridge")).length,
      },
    };
  });

  // Find fastest and cheapest routes
  const fastestRoute = routeAnalysis.reduce((fastest, current) =>
    current.analysis.duration < fastest.analysis.duration ? current : fastest
  );

  const cheapestRoute = routeAnalysis.reduce((cheapest, current) =>
    BigInt(current.route.toAmount) > BigInt(cheapest.route.toAmount) ? current : cheapest
  );

  return {
    analyzedRoutes: routeAnalysis,
    fastest: fastestRoute,
    cheapest: cheapestRoute,
  };
}

/**
 * GET /api/lifi/routes
 *
 * Get optimal routes for transfers/swaps/bridges using LI.FI
 *
 * Query Parameters:
 * - fromChain: Source chain ID
 * - toChain: Destination chain ID
 * - fromToken: Source token address or symbol
 * - toToken: Destination token address or symbol
 * - fromAmount: Amount to transfer (in token units, not wei)
 * - fromAddress: User's address on source chain
 * - toAddress: Recipient address on destination chain (optional, defaults to fromAddress)
 * - slippage: Maximum slippage tolerance (0-1, default 0.005)
 * - order: Route preference (RECOMMENDED/FASTEST/CHEAPEST)
 * - maxPriceImpact: Maximum acceptable price impact (0-1, default 0.05)
 */
export async function GET(request: NextRequest) {
  const requestId = `routes_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    console.log(`🚀 Route planning request ${requestId} started`);

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const rawParams = {
      fromChain: parseInt(searchParams.get("fromChain") || "0"),
      toChain: parseInt(searchParams.get("toChain") || "0"),
      fromToken: searchParams.get("fromToken") || "",
      toToken: searchParams.get("toToken") || "",
      fromAmount: searchParams.get("fromAmount") || "",
      fromAddress: searchParams.get("fromAddress") || "",
      toAddress: searchParams.get("toAddress") || undefined,
      slippage: searchParams.get("slippage") ? parseFloat(searchParams.get("slippage")!) : 0.005,
      order: (searchParams.get("order") as "RECOMMENDED" | "FASTEST" | "CHEAPEST") || "RECOMMENDED",
      allowBridges: searchParams.get("allowBridges")?.split(",").filter(Boolean),
      denyBridges: searchParams.get("denyBridges")?.split(",").filter(Boolean),
      maxPriceImpact: searchParams.get("maxPriceImpact") ? parseFloat(searchParams.get("maxPriceImpact")!) : 0.05,
    };

    console.log(`📋 Route parameters:`, rawParams);

    // Validate request parameters
    const validatedParams = RouteRequestSchema.parse(rawParams);

    // Get routes from LI.FI
    const lifiResponse = await getRoutes({
      fromChain: validatedParams.fromChain,
      toChain: validatedParams.toChain,
      fromToken: validatedParams.fromToken,
      toToken: validatedParams.toToken,
      fromAmount: validatedParams.fromAmount,
      fromAddress: validatedParams.fromAddress,
      toAddress: validatedParams.toAddress,
      slippage: validatedParams.slippage,
      order: validatedParams.order,
      allowBridges: validatedParams.allowBridges,
      denyBridges: validatedParams.denyBridges,
    });

    console.log(`✅ LI.FI returned ${lifiResponse.routes.length} routes`);

    if (lifiResponse.routes.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          routes: [],
          summary: {
            totalRoutes: 0,
          },
          requestId,
          timestamp: Date.now(),
        },
      }, {
        status: 200,
        headers: { "X-Request-ID": requestId },
      });
    }

    // Analyze routes
    const analysis = analyzeRoutes(lifiResponse.routes, validatedParams.maxPriceImpact);

    // Pick recommended route based on order preference
    let recommendedRoute: Route | null = null;
    if (validatedParams.order === "FASTEST") {
      recommendedRoute = analysis.fastest.route;
    } else if (validatedParams.order === "CHEAPEST") {
      recommendedRoute = analysis.cheapest.route;
    } else {
      // RECOMMENDED: use LI.FI's default ordering (first route)
      recommendedRoute = pickBestRoute(lifiResponse.routes, "recommended");
    }

    // Filter out unacceptable routes based on price impact
    const acceptableRoutes = analysis.analyzedRoutes
      .filter(r => r.analysis.acceptable)
      .map(r => r.route);

    const alternatives = acceptableRoutes.filter(route => route.id !== recommendedRoute?.id);

    // Build response summary
    const summary = {
      totalRoutes: lifiResponse.routes.length,
      fastestRoute: {
        id: analysis.fastest.route.id,
        duration: analysis.fastest.analysis.duration,
        durationFormatted: formatDuration(analysis.fastest.analysis.duration),
      },
      cheapestRoute: {
        id: analysis.cheapest.route.id,
        totalCost: analysis.cheapest.analysis.totalGasCost,
        outputAmount: analysis.cheapest.route.toAmount,
      },
      priceImpact: recommendedRoute ? {
        percentage: calculatePriceImpact(recommendedRoute),
        acceptable: calculatePriceImpact(recommendedRoute) <= validatedParams.maxPriceImpact,
      } : undefined,
    };

    console.log(`✅ Route planning ${requestId} completed successfully:`, {
      totalRoutes: lifiResponse.routes.length,
      acceptableRoutes: acceptableRoutes.length,
      recommended: recommendedRoute?.id,
    });

    const response: RouteResponse = {
      success: true,
      data: {
        routes: acceptableRoutes,
        recommended: recommendedRoute,
        alternatives: alternatives.slice(0, 3), // Limit alternatives
        summary,
        requestId,
        timestamp: Date.now(),
      },
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120", // Cache for 1 minute
        "X-Request-ID": requestId,
      },
    });

  } catch (error) {
    console.error(`❌ Route planning ${requestId} failed:`, error);

    // Handle LI.FI specific errors
    if (error instanceof LifiError) {
      const response: RouteResponse = {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      };

      return NextResponse.json(response, {
        status: error.status || 500,
        headers: { "X-Request-ID": requestId },
      });
    }

    // Handle validation errors
    if (error instanceof z.ZodError) {
      const response: RouteResponse = {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request parameters",
          details: error.issues,
        },
      };

      return NextResponse.json(response, {
        status: 400,
        headers: { "X-Request-ID": requestId },
      });
    }

    // Handle unexpected errors
    const response: RouteResponse = {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred while planning routes",
        details: process.env.NODE_ENV === "development" ? {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        } : undefined,
      },
    };

    return NextResponse.json(response, {
      status: 500,
      headers: { "X-Request-ID": requestId },
    });
  }
}

/**
 * POST /api/lifi/routes
 *
 * Advanced route planning with complex parameters and multiple scenarios
 */
export async function POST(request: NextRequest) {
  const requestId = `advanced_routes_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    console.log(`🚀 Advanced route planning request ${requestId} started`);

    const body = await request.json();

    // Advanced route planning schema
    const AdvancedRouteSchema = z.object({
      route: RouteRequestSchema,
      preferences: z.object({
        prioritizeSpeed: z.boolean().default(false),
        prioritizeCost: z.boolean().default(false),
        avoidBridges: z.array(z.string()).default([]),
        maxBridgeCount: z.number().int().min(0).max(5).default(2),
        requireDirectRoute: z.boolean().default(false),
      }).optional(),
      scenarios: z.array(z.object({
        name: z.string(),
        modifiedParams: z.record(z.string(), z.any()),
      })).optional(),
    });

    const validatedBody = AdvancedRouteSchema.parse(body);

    console.log(`📋 Advanced route planning with ${validatedBody.scenarios?.length || 0} scenarios`);

    // Get base route
    const baseRoutes = await getRoutes(validatedBody.route);

    // Process scenarios if provided
    let scenarioResults: any[] = [];
    if (validatedBody.scenarios?.length) {
      const scenarioPromises = validatedBody.scenarios.map(async (scenario) => {
        try {
          const modifiedParams = { ...validatedBody.route, ...scenario.modifiedParams };
          const scenarioRoutes = await getRoutes(modifiedParams);
          return {
            name: scenario.name,
            routes: scenarioRoutes.routes,
            success: true,
          };
        } catch (error) {
          return {
            name: scenario.name,
            routes: [],
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      });

      scenarioResults = await Promise.all(scenarioPromises);
    }

    // Apply preferences to filter and sort routes
    let finalRoutes = baseRoutes.routes;

    if (validatedBody.preferences) {
      const prefs = validatedBody.preferences;

      // Filter by bridge count
      if (prefs.maxBridgeCount !== undefined) {
        finalRoutes = finalRoutes.filter(route => {
          const bridgeCount = route.steps.filter(step => step.type?.includes("cross") || step.type?.includes("bridge")).length;
          return bridgeCount <= prefs.maxBridgeCount;
        });
      }

      // Filter direct routes only
      if (prefs.requireDirectRoute) {
        finalRoutes = finalRoutes.filter(route => route.steps.length === 1);
      }

      // Filter out unwanted bridges
      if (prefs.avoidBridges.length > 0) {
        finalRoutes = finalRoutes.filter(route => {
          return !route.steps.some(step => prefs.avoidBridges.includes(step.tool));
        });
      }
    }

    // Analyze all routes
    const analysis = analyzeRoutes(finalRoutes, validatedBody.route.maxPriceImpact || 0.05);

    console.log(`✅ Advanced route planning ${requestId} completed: ${finalRoutes.length} routes`);

    return NextResponse.json({
      success: true,
      data: {
        baseRoutes: analysis.analyzedRoutes.map(r => r.route),
        recommended: analysis.analyzedRoutes[0]?.route,
        analysis: {
          fastest: analysis.fastest,
          cheapest: analysis.cheapest,
          summary: {
            totalRoutes: finalRoutes.length,
            averageDuration: analysis.analyzedRoutes.reduce((sum, r) => sum + r.analysis.duration, 0) / Math.max(1, analysis.analyzedRoutes.length),
            bridgeOptions: [...new Set(finalRoutes.flatMap(r => r.steps.map(s => s.tool)))],
          },
        },
        scenarios: scenarioResults,
        requestId,
        timestamp: Date.now(),
      },
    }, {
      status: 200,
      headers: { "X-Request-ID": requestId },
    });

  } catch (error) {
    console.error(`❌ Advanced route planning ${requestId} failed:`, error);

    return NextResponse.json({
      success: false,
      error: {
        code: "ADVANCED_ROUTING_ERROR",
        message: "Advanced route planning failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
    }, {
      status: 500,
      headers: { "X-Request-ID": requestId },
    });
  }
}