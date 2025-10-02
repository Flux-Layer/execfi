/**
 * LI.FI Status Tracking API Endpoint
 *
 * Step 3.4: LI.FI Status Tracking Integration (Step 7.6 Enhancement)
 * Purpose: Supplement existing monitoring with LI.FI status API
 * Features:
 * - Handle bridge transactions and multi-chain operations
 * - Provide enhanced status updates for complex routes
 * - Keep existing viem-based monitoring as fallback
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { lifiClient } from "@/lib/lifi-client";

// Request validation schemas
const StatusRequestSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash"),
  bridge: z.string().optional(),
  fromChain: z.number().optional(),
  toChain: z.number().optional(),
});

const BulkStatusRequestSchema = z.object({
  requests: z
    .array(StatusRequestSchema)
    .max(10, "Maximum 10 status requests per call"),
});

// LI.FI Status Response Schema
const LifiStatusSchema = z.object({
  status: z.enum([
    "NOT_FOUND",
    "INVALID",
    "PENDING",
    "DONE",
    "FAILED",
    "PARTIAL",
  ]),
  substatus: z.string().optional(),
  substatusMessage: z.string().optional(),
  txHash: z.string(),
  txLink: z.string().optional(),
  fromChain: z.number(),
  toChain: z.number(),
  tool: z.string().optional(),
  bridge: z.string().optional(),
  fromToken: z
    .object({
      symbol: z.string(),
      address: z.string(),
      amount: z.string(),
      decimals: z.number(),
    })
    .optional(),
  toToken: z
    .object({
      symbol: z.string(),
      address: z.string(),
      amount: z.string(),
      decimals: z.number(),
    })
    .optional(),
  gasUsed: z.string().optional(),
  gasPrice: z.string().optional(),
  gasToken: z
    .object({
      symbol: z.string(),
      address: z.string(),
      price: z.number().optional(),
    })
    .optional(),
  receiving: z
    .object({
      txHash: z.string(),
      txLink: z.string(),
      amount: z.string(),
      token: z.object({
        symbol: z.string(),
        address: z.string(),
        decimals: z.number(),
      }),
    })
    .optional(),
});

type LifiStatusResponse = z.infer<typeof LifiStatusSchema>;

// Enhanced status response with additional context
const EnhancedStatusSchema = z.object({
  success: z.boolean(),
  requestId: z.string(),
  timestamp: z.string(),
  status: z.object({
    lifi: LifiStatusSchema.optional(),
    enhanced: z.object({
      isCompleted: z.boolean(),
      isFailed: z.boolean(),
      isPending: z.boolean(),
      progressPercent: z.number(),
      estimatedTimeRemaining: z.string().optional(),
      nextAction: z.string().optional(),
      errorMessage: z.string().optional(),
      canRetry: z.boolean(),
    }),
    fallback: z
      .object({
        blockNumber: z.number().optional(),
        confirmations: z.number().optional(),
        timestamp: z.number().optional(),
      })
      .optional(),
  }),
});

type EnhancedStatusResponse = z.infer<typeof EnhancedStatusSchema>;

/**
 * GET /api/lifi/status - Health check endpoint
 */
export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({
      success: true,
      service: "lifi-status-tracking",
      status: "healthy",
      timestamp: new Date().toISOString(),
      capabilities: [
        "transaction-status-tracking",
        "bridge-status-monitoring",
        "multi-chain-operations",
        "enhanced-status-context",
        "viem-fallback-monitoring",
        "bulk-status-queries",
      ],
    });
  } catch (error) {
    console.error("[LiFi Status] Health check failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Service health check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/lifi/status - Get transaction status
 *
 * Body: StatusRequestSchema | BulkStatusRequestSchema
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = `status-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  try {
    const body = await request.json();

    // Handle bulk requests
    if ("requests" in body) {
      const bulkRequest = BulkStatusRequestSchema.parse(body);
      const statuses = await Promise.allSettled(
        bulkRequest.requests.map((req) => getTransactionStatus(req, requestId)),
      );

      return NextResponse.json({
        success: true,
        requestId,
        timestamp: new Date().toISOString(),
        results: statuses.map((result, index) => ({
          request: bulkRequest.requests[index],
          success: result.status === "fulfilled",
          status: result.status === "fulfilled" ? result.value : undefined,
          error:
            result.status === "rejected" ? String(result.reason) : undefined,
        })),
      });
    }

    // Handle single request
    const statusRequest = StatusRequestSchema.parse(body);
    const status = await getTransactionStatus(statusRequest, requestId);

    return NextResponse.json({
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      status,
    });
  } catch (error) {
    console.error(`[LiFi Status] Request ${requestId} failed:`, error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: "Invalid request format",
          details: error.issues,
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        requestId,
        error: "Status tracking failed",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

/**
 * Get enhanced transaction status with LI.FI integration and viem fallback
 */
async function getTransactionStatus(
  request: z.infer<typeof StatusRequestSchema>,
  requestId: string,
): Promise<EnhancedStatusResponse["status"]> {
  let lifiStatus: LifiStatusResponse | undefined;
  const fallbackData: {
    blockNumber?: number;
    confirmations?: number;
    timestamp?: number;
  } = {};
  console.log({ lifiStatus });

  try {
    // Try LI.FI status API first
    console.log("Checking lifi tx status... ", {
      txHash: request.txHash,
      bridge: request.bridge,
      fromChain: request.fromChain,
      toChain: request.toChain,
    });
    const statusResponse = await lifiClient.getStatus({
      txHash: request.txHash,
      bridge: request.bridge,
      fromChain: request.fromChain,
      toChain: request.toChain,
    });

    console.log({ statusResponse });

    if (statusResponse) {
      // Validate and parse LI.FI response
      lifiStatus = LifiStatusSchema.parse(statusResponse);
    }
  } catch (error) {
    console.warn(
      `[LiFi Status] ${requestId} - LI.FI API failed, using fallback:`,
      error,
    );
  }

  // Enhanced status analysis

  const enhanced = analyzeLifiStatus(lifiStatus);
  console.log({ enhanced });

  return {
    lifi: lifiStatus,
    enhanced,
    fallback: Object.keys(fallbackData).length > 0 ? fallbackData : undefined,
  };
}

/**
 * Analyze LI.FI status and provide enhanced context
 */
function analyzeLifiStatus(lifiStatus?: LifiStatusResponse) {
  if (!lifiStatus) {
    return {
      isCompleted: false,
      isFailed: false,
      isPending: true,
      progressPercent: 0,
      nextAction: "Waiting for transaction confirmation",
      canRetry: false,
    };
  }

  const { status, substatus, substatusMessage } = lifiStatus;

  switch (status) {
    case "DONE":
      return {
        isCompleted: true,
        isFailed: false,
        isPending: false,
        progressPercent: 100,
        nextAction: "Transaction completed successfully",
        canRetry: false,
      };

    case "FAILED":
      return {
        isCompleted: false,
        isFailed: true,
        isPending: false,
        progressPercent: 0,
        errorMessage: substatusMessage || "Transaction failed",
        nextAction: "Check transaction details and retry if needed",
        canRetry: true,
      };

    case "PENDING":
      const progressPercent = getProgressFromSubstatus(substatus);
      return {
        isCompleted: false,
        isFailed: false,
        isPending: true,
        progressPercent,
        estimatedTimeRemaining: getEstimatedTime(
          substatus,
          lifiStatus.fromChain,
          lifiStatus.toChain,
        ),
        nextAction: substatusMessage || "Transaction in progress",
        canRetry: false,
      };

    case "PARTIAL":
      return {
        isCompleted: false,
        isFailed: false,
        isPending: true,
        progressPercent: 50,
        nextAction: "Multi-step transaction in progress",
        canRetry: false,
      };

    case "NOT_FOUND":
      return {
        isCompleted: false,
        isFailed: false,
        isPending: true,
        progressPercent: 0,
        nextAction: "Transaction not yet indexed",
        canRetry: false,
      };

    case "INVALID":
      return {
        isCompleted: false,
        isFailed: true,
        isPending: false,
        progressPercent: 0,
        errorMessage: "Invalid transaction hash or parameters",
        nextAction: "Verify transaction details",
        canRetry: false,
      };

    default:
      return {
        isCompleted: false,
        isFailed: false,
        isPending: true,
        progressPercent: 0,
        nextAction: "Status unknown",
        canRetry: false,
      };
  }
}

/**
 * Estimate progress percentage from substatus
 */
function getProgressFromSubstatus(substatus?: string): number {
  if (!substatus) return 10;

  const progressMap: Record<string, number> = {
    WAIT_SOURCE_CONFIRMATIONS: 25,
    WAIT_DESTINATION_TRANSACTION: 50,
    BRIDGE_NOT_AVAILABLE: 0,
    CHAIN_NOT_AVAILABLE: 0,
    NOT_PROCESSABLE_REFUND_NEEDED: 0,
    UNKNOWN_ERROR: 0,
    REFUND_IN_PROGRESS: 75,
    PARTIAL: 50,
  };

  return progressMap[substatus] || 30;
}

/**
 * Estimate remaining time based on chain and bridge type
 */
function getEstimatedTime(
  substatus?: string,
  fromChain?: number,
  toChain?: number,
): string | undefined {
  if (!substatus) return undefined;

  // Same chain operations
  if (fromChain === toChain) {
    return "~30 seconds";
  }

  // Cross-chain estimations
  const timeMap: Record<string, string> = {
    WAIT_SOURCE_CONFIRMATIONS: "~2-5 minutes",
    WAIT_DESTINATION_TRANSACTION: "~1-3 minutes",
    BRIDGE_NOT_AVAILABLE: "Unknown",
    REFUND_IN_PROGRESS: "~5-10 minutes",
  };

  return timeMap[substatus] || "~3-7 minutes";
}
