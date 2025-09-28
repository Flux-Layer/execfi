// app/api/lifi/quote/route.ts - Quote validation API endpoint

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateQuote, LifiError, LifiRouteSchema } from "@/lib/lifi-client";

// Request validation schema
const QuoteValidationRequestSchema = z.object({
  route: LifiRouteSchema,
  options: z.object({
    maxSlippageTolerance: z.number().min(0).max(1).default(0.05), // 5% default
    checkFreshness: z.boolean().default(true),
    requireSameTools: z.boolean().default(true),
  }).default({
    maxSlippageTolerance: 0.05,
    checkFreshness: true,
    requireSameTools: true,
  }),
});

// Response schema
const QuoteValidationResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    valid: z.boolean(),
    reason: z.string().optional(),
    originalRoute: z.any(), // LifiRoute
    freshRoute: z.any().optional(), // LifiRoute
    analysis: z.object({
      priceChange: z.object({
        percentage: z.number(),
        direction: z.enum(["favorable", "unfavorable", "unchanged"]),
        amount: z.string(),
      }),
      routeComparison: z.object({
        sameTools: z.boolean(),
        stepCountMatch: z.boolean(),
        estimatedDurationChange: z.number(),
      }),
      recommendation: z.enum(["proceed", "refresh", "abort"]),
    }),
    timestamp: z.number(),
    requestId: z.string(),
  }).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
});

export type QuoteValidationResponse = z.infer<typeof QuoteValidationResponseSchema>;

/**
 * Calculate percentage change between two amounts
 */
function calculatePercentageChange(original: string, current: string): number {
  const originalAmount = BigInt(original);
  const currentAmount = BigInt(current);

  if (originalAmount === 0n) return 0;

  const change = ((currentAmount - originalAmount) * 10000n) / originalAmount;
  return Number(change) / 100; // Convert basis points to percentage
}

/**
 * Analyze route differences and provide recommendations
 */
function analyzeRouteChanges(originalRoute: any, freshRoute: any, maxSlippage: number) {
  const priceChangePercent = calculatePercentageChange(originalRoute.toAmount, freshRoute.toAmount);
  const priceChangeDirection: "favorable" | "unfavorable" | "unchanged" =
    priceChangePercent > 0.1 ? "favorable" :
    priceChangePercent < -0.1 ? "unfavorable" : "unchanged";

  const sameTools: boolean = originalRoute.steps.length === freshRoute.steps.length &&
                           originalRoute.steps.every((step: any, i: number) =>
                             step.tool === freshRoute.steps[i]?.tool);

  const stepCountMatch = originalRoute.steps.length === freshRoute.steps.length;

  const originalDuration = originalRoute.steps.reduce((sum: number, step: any) =>
    sum + step.estimate.executionDuration, 0);
  const freshDuration = freshRoute.steps.reduce((sum: number, step: any) =>
    sum + step.estimate.executionDuration, 0);
  const durationChange = freshDuration - originalDuration;

  // Determine recommendation
  let recommendation: "proceed" | "refresh" | "abort";
  if (Math.abs(priceChangePercent) > maxSlippage * 100) {
    recommendation = "abort";
  } else if (Math.abs(priceChangePercent) > maxSlippage * 50 || !sameTools) {
    recommendation = "refresh";
  } else {
    recommendation = "proceed";
  }

  return {
    priceChange: {
      percentage: priceChangePercent,
      direction: priceChangeDirection,
      amount: (BigInt(freshRoute.toAmount) - BigInt(originalRoute.toAmount)).toString(),
    },
    routeComparison: {
      sameTools,
      stepCountMatch,
      estimatedDurationChange: durationChange,
    },
    recommendation,
  };
}

/**
 * POST /api/lifi/quote
 *
 * Validate quote freshness and check if routes are still optimal
 *
 * Body:
 * - route: The original LI.FI route to validate
 * - options: Validation options (slippage tolerance, freshness checks)
 *
 * Returns:
 * - valid: Whether the quote is still acceptable
 * - reason: Explanation if quote is invalid
 * - freshRoute: Updated route if available
 * - analysis: Detailed comparison and recommendation
 */
export async function POST(request: NextRequest) {
  const requestId = `quote_validation_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    console.log(`🔍 Quote validation request ${requestId} started`);

    const body = await request.json();

    // Validate request body
    const validatedBody = QuoteValidationRequestSchema.parse(body);
    const { route, options } = validatedBody;

    console.log(`📋 Validating quote for route ${route.id}:`, {
      fromChain: route.fromChainId,
      toChain: route.toChainId,
      fromToken: route.fromToken.symbol,
      toToken: route.toToken.symbol,
      amount: route.fromAmount,
    });

    // Validate the quote using the LI.FI client
    const validationResult = await validateQuote(route as any);

    if (!validationResult.valid) {
      console.log(`❌ Quote validation failed: ${validationResult.reason}`);

      const response: QuoteValidationResponse = {
        success: true, // Request succeeded, but quote is invalid
        data: {
          valid: false,
          reason: validationResult.reason,
          originalRoute: route,
          freshRoute: validationResult.freshRoute,
          analysis: validationResult.freshRoute
            ? analyzeRouteChanges(route, validationResult.freshRoute, options.maxSlippageTolerance || 0.05)
            : {
                priceChange: {
                  percentage: 0,
                  direction: "unchanged" as const,
                  amount: "0",
                },
                routeComparison: {
                  sameTools: false,
                  stepCountMatch: false,
                  estimatedDurationChange: 0,
                },
                recommendation: "abort" as const,
              },
          timestamp: Date.now(),
          requestId,
        },
      };

      return NextResponse.json(response, {
        status: 200,
        headers: { "X-Request-ID": requestId },
      });
    }

    // Quote is valid - provide analysis
    const freshRoute = validationResult.freshRoute || route;
    const analysis = analyzeRouteChanges(route, freshRoute, options.maxSlippageTolerance || 0.05);

    console.log(`✅ Quote validation ${requestId} completed:`, {
      valid: true,
      priceChange: `${analysis.priceChange.percentage.toFixed(2)}%`,
      recommendation: analysis.recommendation,
    });

    const response: QuoteValidationResponse = {
      success: true,
      data: {
        valid: true,
        originalRoute: route,
        freshRoute,
        analysis,
        timestamp: Date.now(),
        requestId,
      },
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate", // Don't cache quote validations
        "X-Request-ID": requestId,
      },
    });

  } catch (error) {
    console.error(`❌ Quote validation ${requestId} failed:`, error);

    // Handle LI.FI specific errors
    if (error instanceof LifiError) {
      const response: QuoteValidationResponse = {
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
      const response: QuoteValidationResponse = {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: error.issues,
        },
      };

      return NextResponse.json(response, {
        status: 400,
        headers: { "X-Request-ID": requestId },
      });
    }

    // Handle unexpected errors
    const response: QuoteValidationResponse = {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred during quote validation",
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
 * GET /api/lifi/quote/health
 *
 * Health check endpoint for quote validation service
 */
export async function GET(request: NextRequest) {
  try {
    // Simple health check - could be expanded to check LI.FI connectivity
    return NextResponse.json({
      success: true,
      status: "healthy",
      timestamp: Date.now(),
      service: "quote-validation",
      version: "1.0.0",
    }, {
      status: 200,
      headers: {
        "Cache-Control": "no-cache",
      },
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: Date.now(),
    }, {
      status: 500,
    });
  }
}