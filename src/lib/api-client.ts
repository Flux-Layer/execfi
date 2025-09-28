/**
 * Frontend API Client for LI.FI Integration
 *
 * Phase 4.3: API Client Integration
 * Purpose: Type-safe API calls for frontend components
 * Features:
 * - Type-safe API calls with Zod validation
 * - Error handling and retry logic
 * - Request/response validation
 * - Consistent error mapping
 */

import { z } from "zod";

// Request/Response schemas
export const TokenSearchRequestSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  chains: z.array(z.number()).optional(),
  limit: z.number().min(1).max(100).optional().default(50),
});

export const TokenSearchResponseSchema = z.object({
  success: z.boolean(),
  requestId: z.string(),
  timestamp: z.string(),
  tokens: z.array(z.object({
    address: z.string(),
    symbol: z.string(),
    name: z.string(),
    chainId: z.number(),
    chainName: z.string(),
    decimals: z.number(),
    logoURI: z.string().optional(),
    verified: z.boolean(),
    priceUSD: z.string().optional(),
  })),
});

export const RouteRequestSchema = z.object({
  fromChain: z.number(),
  toChain: z.number(),
  fromToken: z.string(),
  toToken: z.string(),
  fromAmount: z.string(),
  fromAddress: z.string(),
  toAddress: z.string(),
  slippage: z.number().optional(),
  preferences: z.object({
    order: z.enum(['FASTEST', 'CHEAPEST', 'RECOMMENDED']).optional(),
    allowBridges: z.array(z.string()).optional(),
    denyBridges: z.array(z.string()).optional(),
    maxBridgeCount: z.number().optional(),
  }).optional(),
});

export const RouteResponseSchema = z.object({
  success: z.boolean(),
  requestId: z.string(),
  timestamp: z.string(),
  routes: z.array(z.object({
    id: z.string(),
    fromAmount: z.string(),
    toAmount: z.string(),
    gasCost: z.string(),
    executionTime: z.string(),
    tool: z.string(),
    steps: z.array(z.any()),
    tags: z.array(z.string()),
  })),
  analysis: z.object({
    fastest: z.string().optional(),
    cheapest: z.string().optional(),
    recommended: z.string().optional(),
  }).optional(),
});

export const PrepareRequestSchema = z.object({
  norm: z.object({
    kind: z.string(),
    chainId: z.number(),
    amountWei: z.string(),
    to: z.string(),
  }),
  fromAddress: z.string(),
});

export const PrepareResponseSchema = z.object({
  success: z.boolean(),
  requestId: z.string(),
  timestamp: z.string(),
  transactionData: z.object({
    to: z.string(),
    value: z.string(),
    data: z.string().optional(),
    gasLimit: z.string().optional(),
  }),
  route: z.object({
    id: z.string(),
    tool: z.string(),
    fromAmount: z.string(),
    toAmount: z.string(),
    gasCost: z.string(),
  }).optional(),
});

export const StatusRequestSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash"),
  bridge: z.string().optional(),
  fromChain: z.number().optional(),
  toChain: z.number().optional(),
});

export const StatusResponseSchema = z.object({
  success: z.boolean(),
  requestId: z.string(),
  timestamp: z.string(),
  status: z.object({
    lifi: z.object({
      status: z.enum(['NOT_FOUND', 'INVALID', 'PENDING', 'DONE', 'FAILED', 'PARTIAL']),
      substatus: z.string().optional(),
      substatusMessage: z.string().optional(),
      txHash: z.string(),
      txLink: z.string().optional(),
    }).optional(),
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
    fallback: z.object({
      blockNumber: z.number().optional(),
      confirmations: z.number().optional(),
      timestamp: z.number().optional(),
    }).optional(),
  }),
});

// Type exports
export type TokenSearchRequest = z.infer<typeof TokenSearchRequestSchema>;
export type TokenSearchResponse = z.infer<typeof TokenSearchResponseSchema>;
export type RouteRequest = z.infer<typeof RouteRequestSchema>;
export type RouteResponse = z.infer<typeof RouteResponseSchema>;
export type PrepareRequest = z.infer<typeof PrepareRequestSchema>;
export type PrepareResponse = z.infer<typeof PrepareResponseSchema>;
export type StatusRequest = z.infer<typeof StatusRequestSchema>;
export type StatusResponse = z.infer<typeof StatusResponseSchema>;

// Error classes
export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string,
    public requestId?: string
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export class ApiValidationError extends ApiClientError {
  constructor(
    message: string,
    public validationErrors: any[],
    endpoint: string,
    requestId?: string
  ) {
    super(message, 400, endpoint, requestId);
    this.name = "ApiValidationError";
  }
}

// Rate limiting and retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
};

/**
 * Make API request with retry logic and validation
 */
async function apiRequest<TRequest, TResponse>(
  endpoint: string,
  method: 'GET' | 'POST',
  requestSchema: z.ZodSchema<TRequest>,
  responseSchema: z.ZodSchema<TResponse>,
  data?: TRequest,
  options: { timeout?: number; retries?: number } = {}
): Promise<TResponse> {
  const { timeout = 10000, retries = RETRY_CONFIG.maxRetries } = options;

  // Validate request data if provided
  if (data) {
    try {
      requestSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ApiValidationError(
          "Request validation failed",
          error.issues,
          endpoint
        );
      }
      throw error;
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const requestInit: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      };

      if (data && method === 'POST') {
        requestInit.body = JSON.stringify(data);
      }

      // Add query parameters for GET requests
      let url = endpoint;
      if (data && method === 'GET') {
        const params = new URLSearchParams();
        Object.entries(data as any).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        });
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
      }

      const response = await fetch(url, requestInit);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new ApiClientError(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`,
          response.status,
          endpoint
        );
      }

      const responseData = await response.json();

      // Validate response
      try {
        return responseSchema.parse(responseData);
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error("Response validation failed:", error.issues);
          throw new ApiValidationError(
            "Response validation failed",
            error.issues,
            endpoint,
            responseData.requestId
          );
        }
        throw error;
      }
    } catch (error) {
      lastError = error as Error;

      // Don't retry on validation errors or 4xx errors
      if (
        error instanceof ApiValidationError ||
        (error instanceof ApiClientError && error.status >= 400 && error.status < 500)
      ) {
        throw error;
      }

      // Calculate delay for exponential backoff
      if (attempt < retries) {
        const delay = Math.min(
          RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
          RETRY_CONFIG.maxDelay
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        console.warn(`API request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${retries + 1}):`, error);
      }
    }
  }

  throw lastError || new Error("Maximum retries exceeded");
}

/**
 * LI.FI API Client - Frontend Integration
 */
export class LifiApiClient {
  /**
   * Search for tokens across multiple chains
   */
  static async searchTokens(request: TokenSearchRequest): Promise<TokenSearchResponse> {
    return apiRequest(
      '/api/lifi/tokens/search',
      'POST',
      TokenSearchRequestSchema,
      TokenSearchResponseSchema,
      request
    );
  }

  /**
   * Get optimal routes for swaps/bridges
   */
  static async getRoutes(request: RouteRequest): Promise<RouteResponse> {
    return apiRequest(
      '/api/lifi/routes',
      'POST',
      RouteRequestSchema,
      RouteResponseSchema,
      request
    );
  }

  /**
   * Prepare transaction data for execution
   */
  static async prepareTransaction(request: PrepareRequest): Promise<PrepareResponse> {
    return apiRequest(
      '/api/lifi/prepare',
      'POST',
      PrepareRequestSchema,
      PrepareResponseSchema,
      request
    );
  }

  /**
   * Get transaction status with enhanced tracking
   */
  static async getTransactionStatus(request: StatusRequest): Promise<StatusResponse> {
    return apiRequest(
      '/api/lifi/status',
      'POST',
      StatusRequestSchema,
      StatusResponseSchema,
      request
    );
  }

  /**
   * Check service health
   */
  static async checkHealth(): Promise<{ service: string; status: string; timestamp: string }> {
    const healthSchema = z.object({
      success: z.boolean(),
      service: z.string(),
      status: z.string(),
      timestamp: z.string(),
    });

    return apiRequest(
      '/api/lifi/status',
      'GET',
      z.any(),
      healthSchema
    );
  }

  /**
   * Batch token search for multiple symbols
   */
  static async batchSearchTokens(
    symbols: string[],
    chains?: number[]
  ): Promise<Record<string, TokenSearchResponse['tokens']>> {
    const batchRequest = {
      requests: symbols.map(symbol => ({
        symbol,
        chains,
        limit: 10,
      })),
    };

    // For batch requests, we'll call individual searches and aggregate
    // This can be optimized later with a dedicated batch endpoint
    const results = await Promise.allSettled(
      symbols.map(symbol =>
        this.searchTokens({ symbol, chains, limit: 10 })
      )
    );

    const aggregated: Record<string, TokenSearchResponse['tokens']> = {};

    results.forEach((result, index) => {
      const symbol = symbols[index];
      if (result.status === 'fulfilled') {
        aggregated[symbol] = result.value.tokens;
      } else {
        console.warn(`Token search failed for ${symbol}:`, result.reason);
        aggregated[symbol] = [];
      }
    });

    return aggregated;
  }
}

/**
 * Utility functions for common operations
 */
export const ApiUtils = {
  /**
   * Format error for user display
   */
  formatError(error: Error): string {
    if (error instanceof ApiValidationError) {
      return `Validation error: ${error.validationErrors.map(e => e.message).join(', ')}`;
    }

    if (error instanceof ApiClientError) {
      if (error.status === 429) {
        return "Rate limit exceeded. Please try again in a moment.";
      }
      if (error.status >= 500) {
        return "Service temporarily unavailable. Please try again.";
      }
      return error.message;
    }

    return error.message || "An unexpected error occurred";
  },

  /**
   * Check if error is retryable
   */
  isRetryableError(error: Error): boolean {
    if (error instanceof ApiClientError) {
      return error.status >= 500 || error.status === 429;
    }
    return true; // Network errors are typically retryable
  },

  /**
   * Extract request ID from error for debugging
   */
  getRequestId(error: Error): string | undefined {
    if (error instanceof ApiClientError) {
      return error.requestId;
    }
    return undefined;
  },
};