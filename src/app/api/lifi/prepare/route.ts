// app/api/lifi/prepare/route.ts - LI.FI Transaction Preparation API (Step 7.2 Replacement)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getRoutes,
  pickBestRoute,
  validateQuote,
  LifiError,
} from "@/lib/lifi-client";
import { isAddress, getAddress, parseEther, formatEther, encodeFunctionData } from "viem";
import {
  FEE_ENTRYPOINT_ADDRESSES,
  FEE_ENTRYPOINT_ABI,
} from "@/lib/contracts/entrypoint";

// EntryPoint feature flag
const ENABLE_ENTRYPOINT = process.env.NEXT_PUBLIC_ENABLE_ENTRYPOINT === "true";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function isZeroAddress(address: string): boolean {
  return address.trim().toLowerCase() === ZERO_ADDRESS;
}

// Request/Response schemas for API type safety
const PrepareRequestSchema = z.object({
  fromChain: z.number(),
  toChain: z.number(),
  fromToken: z.string(),
  toToken: z.string(),
  amount: z.string(),
  fromAddress: z
    .string()
    .refine((val) => isAddress(val), "Invalid from address"),
  toAddress: z.string().refine((val) => isAddress(val), "Invalid to address"),
  slippage: z.number().optional().default(0.005), // 0.5% default slippage
  routePreference: z
    .enum(["fastest", "cheapest", "recommended"])
    .optional()
    .default("recommended"),
  validateFreshness: z.boolean().optional().default(true),
});

const TransactionDataSchema = z.object({
  to: z.string(),
  value: z.string(),
  data: z.string().optional(),
  gasLimit: z.string().optional(),
  gasPrice: z.string().optional(),
  chainId: z.number(),
});

const PrepareResponseSchema = z.object({
  success: z.boolean(),
  transactionData: TransactionDataSchema.optional(),
  route: z.any().optional(), // LI.FI Route object
  quote: z
    .object({
      fromAmount: z.string(),
      toAmount: z.string(),
      toAmountMin: z.string(),
      gasEstimate: z.string(),
      executionTime: z.number(),
      priceImpact: z.number().optional(),
    })
    .optional(),
  requiresApproval: z
    .object({
      token: z.string(),
      spender: z.string(),
      amount: z.string(),
    })
    .optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.any().optional(),
    })
    .optional(),
  requestId: z.string(),
});

export type PrepareRequest = z.infer<typeof PrepareRequestSchema>;
export type PrepareResponse = z.infer<typeof PrepareResponseSchema>;
export type TransactionData = z.infer<typeof TransactionDataSchema>;

/**
 * Convert LI.FI route to transaction data compatible with existing execution layer
 * This maintains the identical interface that Step 7.3 (Privy execution) expects
 */
function routeToTransactionData(
  route: any,
  fromAddress: string,
): TransactionData {
  // For same-chain transfers, we use the first step's transaction request
  const firstStep = route.steps[0];
  if (!firstStep?.transactionRequest) {
    throw new Error("Route missing transaction request data");
  }

  const txRequest = firstStep.transactionRequest;

  return {
    to: getAddress(txRequest.to), // Ensure checksummed address
    value: txRequest.value || "0x0", // Value in hex (for native transfers)
    data: txRequest.data || "0x", // Transaction data (for contract calls)
    gasLimit: txRequest.gasLimit,
    gasPrice: txRequest.gasPrice,
    chainId: txRequest.chainId,
  };
}

/**
 * Calculate price impact percentage
 */
function calculatePriceImpact(
  fromAmount: string,
  toAmount: string,
  expectedRate?: number,
): number {
  if (!expectedRate) return 0;

  const actualRate = parseFloat(toAmount) / parseFloat(fromAmount);
  return ((expectedRate - actualRate) / expectedRate) * 100;
}

/**
 * POST /api/lifi/prepare - Prepare transaction data via LI.FI routing
 *
 * This endpoint replaces Step 7.2 (Transaction Preparation) in the existing execution flow.
 * It takes normalized intent data and returns unsigned transaction data ready for Privy signing.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = `prepare-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  try {
    const body = await request.json();
    console.log(`🔄 LI.FI Prepare API request [${requestId}]:`, body);

    // Validate request body
    const params = PrepareRequestSchema.parse(body);

    const isSameChain = params.fromChain === params.toChain;
    const isNativeTransfer =
      isSameChain &&
      isZeroAddress(params.fromToken) &&
      isZeroAddress(params.toToken);

    // Handle native transfers (same-chain ETH to ETH)
    if (isNativeTransfer) {
      console.log(
        `🔄 Native transfer detected - creating direct transaction data...`,
      );

      // For native transfers, check if EntryPoint should be used
      let transactionData: TransactionData;

      const entrypoint = FEE_ENTRYPOINT_ADDRESSES[params.fromChain];
      if (ENABLE_ENTRYPOINT && entrypoint) {
        // Route through EntryPoint contract
        console.log(`🔄 Routing native transfer through EntryPoint: ${entrypoint}`);

        transactionData = {
          to: entrypoint,
          value: params.amount,
          data: encodeFunctionData({
            abi: FEE_ENTRYPOINT_ABI,
            functionName: "transferETH",
            args: [getAddress(params.toAddress)],
          }),
          chainId: params.fromChain,
        };
      } else {
        // Direct transfer (current behavior)
        transactionData = {
          to: getAddress(params.toAddress),
          value: params.amount,
          chainId: params.fromChain,
        };
      }

      const response: PrepareResponse = {
        success: true,
        transactionData,
        quote: {
          fromAmount: params.amount,
          toAmount: params.amount, // Native transfer is 1:1
          toAmountMin: params.amount,
          gasEstimate: ENABLE_ENTRYPOINT && entrypoint ? "50000" : "21000", // EntryPoint adds overhead
          executionTime: 30, // Typical block time
        },
        requestId,
      };

      console.log(`✅ Native transfer prepared successfully [${requestId}]`);
      return NextResponse.json(response, { status: 200 });
    }

    // Get optimal routes from LI.FI for non-native transfers
    console.log(
      `🔄 Fetching LI.FI routes for ${params.routePreference} preference...`,
    );
    const routesResponse = await getRoutes({
      fromChain: params.fromChain,
      toChain: params.toChain,
      fromToken: params.fromToken,
      toToken: params.toToken,
      fromAmount: params.amount,
      fromAddress: params.fromAddress,
      toAddress: params.toAddress,
      slippage: params.slippage,
      order: params.routePreference.toUpperCase() as
        | "RECOMMENDED"
        | "FASTEST"
        | "CHEAPEST",
    });

    if (!routesResponse.routes.length) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NO_ROUTES_FOUND",
            message: "No routes available for this transaction",
          },
          requestId,
        } satisfies PrepareResponse,
        { status: 400 },
      );
    }

    // Pick the best route based on preference
    const selectedRoute = pickBestRoute(
      routesResponse.routes,
      params.routePreference,
    );
    if (!selectedRoute) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ROUTE_SELECTION_FAILED",
            message: "Failed to select optimal route",
          },
          requestId,
        } satisfies PrepareResponse,
        { status: 400 },
      );
    }

    console.log(
      `✅ Selected ${params.routePreference} route with ${selectedRoute.steps.length} steps`,
    );

    // Validate quote freshness if requested
    if (params.validateFreshness) {
      console.log(`🔄 Validating route freshness...`);
      const validation = await validateQuote(selectedRoute);

      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "QUOTE_EXPIRED",
              message: validation.reason || "Route quote is no longer valid",
              details: { freshRoute: validation.freshRoute },
            },
            requestId,
          } satisfies PrepareResponse,
          { status: 400 },
        );
      }
    }

    // Convert route to transaction data for Privy execution
    let transactionData = routeToTransactionData(
      selectedRoute,
      params.fromAddress,
    );

    // Check if this is a same-chain ERC-20 transfer that should use EntryPoint
    const isSameChainERC20 =
      params.fromChain === params.toChain &&
      params.fromToken === params.toToken &&
      params.fromToken !== "0x0000000000000000000000000000000000000000";

    const entrypoint = FEE_ENTRYPOINT_ADDRESSES[params.fromChain];

    if (ENABLE_ENTRYPOINT && entrypoint && isSameChainERC20) {
      console.log(`🔄 Routing ERC-20 transfer through EntryPoint: ${entrypoint}`);

      // Override transaction data to route through EntryPoint
      transactionData = {
        to: entrypoint,
        value: "0x0",
        data: encodeFunctionData({
          abi: FEE_ENTRYPOINT_ABI,
          functionName: "transferERC20",
          args: [
            getAddress(params.fromToken),
            getAddress(params.toAddress),
            BigInt(params.amount),
          ],
        }),
        chainId: params.fromChain,
      };
    }

    // Calculate execution metrics
    const totalExecutionTime = selectedRoute.steps.reduce(
      (sum: number, step: any) => sum + (step.estimate?.executionDuration || 0),
      0,
    );

    // Calculate total gas costs
    const totalGasEstimate = selectedRoute.steps.reduce(
      (sum: number, step: any) => {
        const gasAmount = step.estimate?.gasCosts?.[0]?.amount || "0";
        return sum + parseInt(gasAmount, 10);
      },
      0,
    );

    // Build response with transaction data and metadata
    const response: PrepareResponse = {
      success: true,
      transactionData,
      route: selectedRoute,
      quote: {
        fromAmount: selectedRoute.fromAmount,
        toAmount: selectedRoute.toAmount,
        toAmountMin: selectedRoute.toAmountMin,
        gasEstimate: totalGasEstimate.toString(),
        executionTime: totalExecutionTime,
        priceImpact: calculatePriceImpact(
          selectedRoute.fromAmount,
          selectedRoute.toAmount,
        ),
      },
      // Add approval requirement for ERC-20 transfers through EntryPoint
      ...(ENABLE_ENTRYPOINT && entrypoint && isSameChainERC20
        ? {
            requiresApproval: {
              token: params.fromToken,
              spender: entrypoint,
              amount: params.amount,
            },
          }
        : {}),
      requestId,
    };

    console.log(`✅ LI.FI transaction prepared successfully [${requestId}]`);
    console.log(
      `📊 Route summary: ${formatEther(BigInt(selectedRoute.fromAmount))} → ${formatEther(BigInt(selectedRoute.toAmount))}`,
    );

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate", // Don't cache route data
      },
    });
  } catch (error) {
    console.error(`❌ LI.FI Prepare API error [${requestId}]:`, error);

    let errorCode = "PREPARATION_FAILED";
    let errorMessage = "Failed to prepare transaction";
    let statusCode = 500;

    if (error instanceof z.ZodError) {
      errorCode = "INVALID_REQUEST";
      errorMessage = `Invalid request: ${error.issues.map((e) => e.message).join(", ")}`;
      statusCode = 400;
    } else if (error instanceof LifiError) {
      errorCode = error.code;
      errorMessage = error.message;
      statusCode = error.status || 400;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          details: error instanceof Error ? { stack: error.stack } : error,
        },
        requestId,
      } satisfies PrepareResponse,
      { status: statusCode },
    );
  }
}

/**
 * GET /api/lifi/prepare/health - Health check for preparation service
 */
export async function GET(): Promise<NextResponse> {
  try {
    // Perform a lightweight health check
    const healthResponse = {
      status: "healthy",
      service: "lifi-prepare",
      timestamp: new Date().toISOString(),
      capabilities: [
        "native_transfers",
        "erc20_transfers",
        "same_chain_routing",
        "cross_chain_routing",
        "quote_validation",
        "route_optimization",
      ],
    };

    return NextResponse.json(healthResponse, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        service: "lifi-prepare",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
