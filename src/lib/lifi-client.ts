// lib/lifi-client.ts - LI.FI SDK integration with custom wrappers

import { z } from "zod";
import {
  getRoutes as lifiGetRoutes,
  getQuote as lifiGetQuote,
  getTokens as lifiGetTokens,
  type Route,
  type Token,
} from "@lifi/sdk";

// Environment configuration
const LIFI_API_URL = process.env.LIFI_API_URL || "https://li.quest/v1";
const LIFI_API_KEY = process.env.LIFI_API_KEY;
const LIFI_RATE_LIMIT = parseInt(
  process.env.LIFI_RATE_LIMIT_PER_MINUTE || "60",
);

// Rate limiting state
interface RateLimitState {
  requests: number[];
  windowStart: number;
}

const rateLimitState: RateLimitState = {
  requests: [],
  windowStart: Date.now(),
};

// LI.FI API Error types
export class LifiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public details?: any,
  ) {
    super(message);
    this.name = "LifiError";
  }
}

// Zod schemas for LI.FI API responses
export const LifiTokenSchema = z.object({
  address: z.string(),
  symbol: z.string(),
  name: z.string(),
  chainId: z.number(),
  decimals: z.number(),
  logoURI: z.string().optional(),
  priceUSD: z.string().optional(),
});

export const LifiTokensResponseSchema = z.object({
  tokens: z.record(z.string(), z.array(LifiTokenSchema)), // tokens is an object with chainId keys
});

export const LifiRouteStepSchema = z.object({
  id: z.string(),
  type: z.string(),
  tool: z.string(),
  action: z.object({
    fromChainId: z.number(),
    toChainId: z.number(),
    fromToken: LifiTokenSchema,
    toToken: LifiTokenSchema,
    fromAmount: z.string(),
    toAmount: z.string(),
    slippage: z.number(),
  }),
  estimate: z.object({
    tool: z.string(),
    fromAmount: z.string(),
    toAmount: z.string(),
    toAmountMin: z.string(),
    approvalAddress: z.string(),
    executionDuration: z.number(),
    feeCosts: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        token: LifiTokenSchema,
        amount: z.string(),
        amountUSD: z.string().optional(),
      }),
    ),
    gasCosts: z.array(
      z.object({
        type: z.string(),
        price: z.string(),
        estimate: z.string(),
        limit: z.string(),
        amount: z.string(),
        amountUSD: z.string().optional(),
        token: LifiTokenSchema,
      }),
    ),
  }),
  transactionRequest: z
    .object({
      data: z.string(),
      to: z.string(),
      value: z.string(),
      from: z.string(),
      chainId: z.number(),
      gasLimit: z.string().optional(),
      gasPrice: z.string().optional(),
    })
    .optional(),
});

export const LifiRouteSchema = z.object({
  id: z.string(),
  fromChainId: z.number(),
  toChainId: z.number(),
  fromToken: LifiTokenSchema,
  toToken: LifiTokenSchema,
  fromAmount: z.string(),
  toAmount: z.string(),
  toAmountMin: z.string(),
  steps: z.array(LifiRouteStepSchema),
  tags: z.array(z.string()),
});

export const LifiRoutesResponseSchema = z.object({
  routes: z.array(z.any()), // Use z.any() for SDK Route type compatibility
});

export const LifiStatusSchema = z.object({
  status: z.enum(["NOT_FOUND", "INVALID", "PENDING", "DONE", "FAILED"]),
  substatus: z.string().optional(),
  transactionHash: z.string().optional(),
  sending: z
    .object({
      txHash: z.string(),
      txLink: z.string().optional(),
      amount: z.string(),
      token: LifiTokenSchema,
      chainId: z.number(),
      gasPrice: z.string().optional(),
      gasUsed: z.string().optional(),
      gasLimit: z.string().optional(),
    })
    .optional(),
  receiving: z
    .object({
      txHash: z.string().optional(),
      txLink: z.string().optional(),
      amount: z.string().optional(),
      token: LifiTokenSchema,
      chainId: z.number(),
    })
    .optional(),
});

// Type exports
export type LifiToken = z.infer<typeof LifiTokenSchema>;
export type LifiTokensResponse = z.infer<typeof LifiTokensResponseSchema>;
export type LifiRoute = z.infer<typeof LifiRouteSchema>;
export type LifiRouteStep = z.infer<typeof LifiRouteStepSchema>;
export type LifiRoutesResponse = {
  routes: Route[];
};
export type LifiStatus = z.infer<typeof LifiStatusSchema>;

/**
 * Check rate limit before making requests
 */
function checkRateLimit(): boolean {
  const now = Date.now();
  const windowDuration = 60 * 1000; // 1 minute

  // Reset window if needed
  if (now - rateLimitState.windowStart >= windowDuration) {
    rateLimitState.requests = [];
    rateLimitState.windowStart = now;
  }

  // Remove old requests outside current window
  rateLimitState.requests = rateLimitState.requests.filter(
    (timestamp) => now - timestamp < windowDuration,
  );

  // Check if we can make a new request
  if (rateLimitState.requests.length >= LIFI_RATE_LIMIT) {
    return false;
  }

  // Record this request
  rateLimitState.requests.push(now);
  return true;
}

/**
 * Sleep for exponential backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Core HTTP client with retry logic and rate limiting
 */
async function lifiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  schema?: z.ZodSchema<T>,
): Promise<T> {
  // Check rate limit
  if (!checkRateLimit()) {
    throw new LifiError(
      "Rate limit exceeded. Please try again later.",
      "RATE_LIMIT_EXCEEDED",
    );
  }

  const url = `${LIFI_API_URL}${endpoint}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  // Add API key if available
  if (LIFI_API_KEY) {
    headers["x-lifi-api-key"] = LIFI_API_KEY;
  }

  const requestOptions: RequestInit = {
    ...options,
    headers,
    cache: "no-store", // Ensure fresh data for route calculations
  };

  // Retry logic with exponential backoff
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 LI.FI API Request (attempt ${attempt}):`, url);

      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        throw new LifiError(
          errorData.message ||
            `HTTP ${response.status}: ${response.statusText}`,
          "API_ERROR",
          response.status,
          errorData,
        );
      }

      const data = await response.json();

      // Validate response with schema if provided
      if (schema) {
        try {
          const validatedData = schema.parse(data);
          console.log(`✅ LI.FI API Response validated successfully`);
          return validatedData;
        } catch (validationError) {
          console.error(
            "❌ LI.FI API Response validation failed:",
            validationError,
          );
          throw new LifiError(
            "Invalid response format from LI.FI API",
            "VALIDATION_ERROR",
            undefined,
            validationError,
          );
        }
      }

      console.log(`✅ LI.FI API Response received successfully`);
      return data;
    } catch (error) {
      console.error(`❌ LI.FI API Request failed (attempt ${attempt}):`, error);

      // Don't retry on client errors (4xx) except rate limits
      if (
        error instanceof LifiError &&
        error.status &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 429
      ) {
        throw error;
      }

      // Don't retry on validation errors
      if (error instanceof LifiError && error.code === "VALIDATION_ERROR") {
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        if (error instanceof LifiError) {
          throw error;
        }
        throw new LifiError(
          `Network error after ${maxRetries} attempts: ${error instanceof Error ? error.message : "Unknown error"}`,
          "NETWORK_ERROR",
        );
      }

      // Exponential backoff: 1s, 2s, 4s
      const backoffMs = Math.pow(2, attempt - 1) * 1000;
      console.log(`⏳ Retrying in ${backoffMs}ms...`);
      await sleep(backoffMs);
    }
  }

  // This should never be reached due to the throw in the loop
  throw new LifiError("Unexpected error in retry loop", "UNEXPECTED_ERROR");
}

/**
 * Search for tokens across chains
 */
export async function searchTokens(params: {
  symbol?: string;
  chain?: number;
  limit?: number;
}): Promise<{ tokens: LifiToken[] }> {
  try {
    console.log(`🔄 LI.FI SDK searchTokens request:`, params);

    // Use the SDK's getTokens function
    const tokensResult = await lifiGetTokens({
      chains: params.chain ? [params.chain] : undefined,
    });

    let allTokens: LifiToken[] = [];

    // Process the SDK response
    if (tokensResult.tokens) {
      for (const [chainId, tokens] of Object.entries(tokensResult.tokens)) {
        for (const token of tokens) {
          // Filter by symbol if provided
          if (
            !params.symbol ||
            token.symbol.toLowerCase().includes(params.symbol.toLowerCase())
          ) {
            allTokens.push(token);
          }
        }
      }
    }

    // Apply limit if specified
    if (params.limit) {
      allTokens = allTokens.slice(0, params.limit);
    }

    console.log(`✅ LI.FI SDK returned ${allTokens.length} tokens`);

    return { tokens: allTokens };
  } catch (error) {
    console.error("❌ LI.FI SDK searchTokens failed:", error);
    throw new LifiError(
      error instanceof Error ? error.message : "Unknown SDK error",
      "SDK_ERROR",
      undefined,
      error,
    );
  }
}

/**
 * Get routes for transfers/swaps/bridges using LI.FI SDK
 */
export async function getRoutes(params: {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  toAddress?: string;
  slippage?: number;
  order?: "RECOMMENDED" | "FASTEST" | "CHEAPEST";
  allowBridges?: string[];
  denyBridges?: string[];
}): Promise<LifiRoutesResponse> {
  try {
    // Map our parameters to the SDK format
    const routesRequest = {
      fromChainId: params.fromChain,
      toChainId: params.toChain,
      fromTokenAddress: params.fromToken,
      toTokenAddress: params.toToken,
      fromAmount: params.fromAmount,
      fromAddress: params.fromAddress,
      toAddress: params.toAddress,
      options: {
        slippage: params.slippage || 0.005,
        order: params.order || "RECOMMENDED",
        allowBridges: params.allowBridges,
        denyBridges: params.denyBridges,
      },
    };

    console.log(`🔄 LI.FI SDK getRoutes request:`, routesRequest);

    const result = await lifiGetRoutes(routesRequest);

    console.log(`✅ LI.FI SDK returned ${result.routes?.length || 0} routes`);

    // Convert SDK response to our expected format
    return {
      routes: result.routes || [],
    };
  } catch (error) {
    console.error("❌ LI.FI SDK getRoutes failed:", error);
    throw new LifiError(
      error instanceof Error ? error.message : "Unknown SDK error",
      "SDK_ERROR",
      undefined,
      error,
    );
  }
}

/**
 * Get transaction status from LI.FI
 */
export async function getStatus(params: {
  txHash: string;
  bridge?: string;
  fromChain?: number;
  toChain?: number;
}): Promise<LifiStatus> {
  const searchParams = new URLSearchParams({
    txHash: params.txHash,
  });

  if (params.bridge) {
    searchParams.append("bridge", params.bridge);
  }
  if (params.fromChain) {
    searchParams.append("fromChain", params.fromChain.toString());
  }
  if (params.toChain) {
    searchParams.append("toChain", params.toChain.toString());
  }

  const endpoint = `/status?${searchParams.toString()}`;
  console.log({ endpoint });
  return lifiRequest(endpoint, { method: "GET" }, LifiStatusSchema);
}

/**
 * Validate a quote is still fresh and executable
 */
export async function validateQuote(route: Route): Promise<{
  valid: boolean;
  reason?: string;
  freshRoute?: Route;
}> {
  try {
    // Re-fetch the same route to check if prices/availability changed
    const freshRoutes = await getRoutes({
      fromChain: route.fromChainId,
      toChain: route.toChainId,
      fromToken: route.fromToken.address,
      toToken: route.toToken.address,
      fromAmount: route.fromAmount,
      fromAddress: route.steps[0]?.transactionRequest?.from || "",
    });

    if (!freshRoutes.routes.length) {
      return {
        valid: false,
        reason: "No routes available for this transaction",
      };
    }

    // Find a similar route (same tools/bridges)
    const freshRoute =
      freshRoutes.routes.find(
        (r) =>
          r.steps.length === route.steps.length &&
          r.steps.every((step, i) => step.tool === route.steps[i]?.tool),
      ) || freshRoutes.routes[0];

    // Check if the route is still viable (within reasonable slippage tolerance)
    const originalToAmount = BigInt(route.toAmount);
    const freshToAmount = BigInt(freshRoute.toAmount);
    const slippageTolerance = 0.05; // 5% tolerance

    const maxSlippage =
      (originalToAmount * BigInt(Math.floor(slippageTolerance * 10000))) /
      10000n;
    const isWithinTolerance = originalToAmount - freshToAmount <= maxSlippage;

    return {
      valid: isWithinTolerance,
      reason: isWithinTolerance
        ? undefined
        : "Route prices have changed significantly",
      freshRoute,
    };
  } catch (error) {
    console.error("Quote validation failed:", error);
    return {
      valid: false,
      reason:
        error instanceof Error ? error.message : "Quote validation failed",
    };
  }
}

/**
 * Helper to pick the best route from multiple options
 */
export function pickBestRoute(
  routes: Route[],
  preference: "fastest" | "cheapest" | "recommended" = "recommended",
): Route | null {
  if (!routes.length) return null;

  if (preference === "fastest") {
    return routes.reduce((best, current) => {
      const bestDuration = best.steps.reduce(
        (sum, step) => sum + step.estimate.executionDuration,
        0,
      );
      const currentDuration = current.steps.reduce(
        (sum, step) => sum + step.estimate.executionDuration,
        0,
      );
      return currentDuration < bestDuration ? current : best;
    });
  }

  if (preference === "cheapest") {
    return routes.reduce((best, current) => {
      const bestValue = BigInt(best.toAmount);
      const currentValue = BigInt(current.toAmount);
      return currentValue > bestValue ? current : best;
    });
  }

  // Recommended: balance of speed and cost
  return routes[0]; // LI.FI returns routes sorted by recommendation
}

/**
 * Health check for LI.FI API
 */
export async function healthCheck(): Promise<boolean> {
  try {
    // Try to fetch supported chains - lightweight endpoint
    await lifiRequest("/chains", { method: "GET" });
    return true;
  } catch (error) {
    console.error("LI.FI health check failed:", error);
    return false;
  }
}

/**
 * Singleton client instance with all methods
 */
export const lifiClient = {
  getTokens: lifiGetTokens,
  getRoutes: lifiGetRoutes,
  getStatus,
  validateQuote,
  pickBestRoute,
  healthCheck,
};
