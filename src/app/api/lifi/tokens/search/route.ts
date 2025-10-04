// app/api/lifi/tokens/search/route.ts - Backward compatibility layer for LI.FI token search
// This endpoint now proxies to the new multi-provider system while maintaining the same response format

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { tokenQueryEngine } from "@/lib/token-query-engine";
import {
  tokenProviderRegistry,
  lifiTokenProvider,
  relayTokenProvider,
  localTokenProvider
} from "@/lib/token-providers";
import type { UnifiedToken } from "@/types/unified-token";

// Initialize providers if not already registered
if (!tokenProviderRegistry.isProviderActive('lifi')) {
  tokenProviderRegistry.register(lifiTokenProvider);
}
if (!tokenProviderRegistry.isProviderActive('relay')) {
  tokenProviderRegistry.register(relayTokenProvider);
}
if (!tokenProviderRegistry.isProviderActive('local')) {
  tokenProviderRegistry.register(localTokenProvider);
}

// Maintain original request validation schema for backward compatibility
const TokenSearchRequestSchema = z.object({
  symbol: z.string().min(1).max(20).optional(),
  chain: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

// Original response schema for backward compatibility
const TokenSearchResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    tokens: z.array(z.object({
      address: z.string(),
      symbol: z.string(),
      name: z.string(),
      chainId: z.number(),
      chainName: z.string().optional(),
      decimals: z.number(),
      logoURI: z.string().optional(),
      verified: z.boolean().default(true),
      priceUSD: z.number().optional(), // Changed from string to number
    })),
    count: z.number(),
    requestId: z.string(),
  }).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
});

export type TokenSearchResponse = z.infer<typeof TokenSearchResponseSchema>;

// Chain ID to name mapping for enhanced responses
const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  137: "Polygon",
  42161: "Arbitrum",
  10: "Optimism",
  43114: "Avalanche",
  56: "BNB Chain",
  250: "Fantom",
  100: "Gnosis",
  1284: "Moonbeam",
  1285: "Moonriver",
  25: "Cronos",
  1101: "Polygon zkEVM",
  324: "zkSync Era",
  59144: "Linea",
  5000: "Mantle",
  534352: "Scroll",
};

/**
 * Convert UnifiedToken to legacy LI.FI token format
 */
function convertToLegacyFormat(token: UnifiedToken) {
  return {
    address: token.address,
    symbol: token.symbol,
    name: token.name,
    chainId: token.chainId,
    chainName: token.chainName || CHAIN_NAMES[token.chainId] || `Chain ${token.chainId}`,
    decimals: token.decimals,
    logoURI: token.logoURI,
    verified: token.verified,
    priceUSD: token.priceUSD,
  };
}

/**
 * GET /api/lifi/tokens/search
 *
 * BACKWARD COMPATIBLE endpoint - maintains the same API contract
 * Now powered by the multi-provider system under the hood
 *
 * Query Parameters:
 * - symbol (optional): Token symbol to search for
 * - chain (optional): Specific chain ID to filter results
 * - limit (optional): Maximum number of results (default: 20, max: 100)
 *
 * Returns:
 * - tokens: Array of matching tokens with chain information (in original format)
 * - count: Number of tokens returned
 * - requestId: Unique identifier for this search request
 */
export async function GET(request: NextRequest) {
  const requestId = `compat_search_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    console.log(`🔍 LI.FI compatible token search request ${requestId} started`);

    // Parse and validate query parameters using original schema
    const { searchParams } = new URL(request.url);
    const rawParams = {
      symbol: searchParams.get("symbol") || undefined,
      chain: searchParams.get("chain") ? parseInt(searchParams.get("chain")!) : undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
    };

    console.log(`📋 LI.FI compatible search parameters:`, rawParams);

    // Validate request parameters
    const validatedParams = TokenSearchRequestSchema.parse(rawParams);

    // If no symbol provided, return supported tokens for the specified chain
    if (!validatedParams.symbol && !validatedParams.chain) {
      return NextResponse.json({
        success: false,
        error: {
          code: "MISSING_PARAMETERS",
          message: "Either 'symbol' or 'chain' parameter is required",
        },
      }, { status: 400 });
    }

    // Convert to multi-provider query format
    const multiProviderParams = {
      symbol: validatedParams.symbol,
      chainIds: validatedParams.chain ? [validatedParams.chain] : undefined,
      limit: validatedParams.limit,
      // Prioritize LI.FI for backward compatibility, but include others for better coverage
      providers: ['lifi', 'local', 'relay'] as any,
      deduplicate: true,
      sortBy: 'confidence' as any,
      sortOrder: 'desc' as any,
    };

    // Execute multi-provider search
    console.log(`🚀 Executing multi-provider search for LI.FI compatibility`);
    const searchResult = await tokenQueryEngine.searchTokens(multiProviderParams);

    if (!searchResult.success) {
      throw new Error('Multi-provider search failed');
    }

    // Convert unified tokens back to legacy LI.FI format
    const legacyTokens = searchResult.tokens.map(convertToLegacyFormat);

    console.log(`✅ LI.FI compatible search returned ${legacyTokens.length} tokens from ${searchResult.metadata.providersSuccessful.length} providers`);

    const response: TokenSearchResponse = {
      success: true,
      data: {
        tokens: legacyTokens,
        count: legacyTokens.length,
        requestId,
      },
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600", // Cache for 5 minutes
        "X-Request-ID": requestId,
        "X-Powered-By": "Multi-Provider-System", // Indicate it's powered by the new system
        "X-Provider-Count": searchResult.metadata.providersSuccessful.length.toString(),
        "X-Compatibility-Mode": "lifi-legacy",
      },
    });

  } catch (error) {
    console.error(`❌ LI.FI compatible token search ${requestId} failed:`, error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      const response: TokenSearchResponse = {
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
    const response: TokenSearchResponse = {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred while searching for tokens",
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
 * POST /api/lifi/tokens/search
 *
 * BACKWARD COMPATIBLE batch search endpoint
 * Now powered by the multi-provider system under the hood
 *
 * Body:
 * - searches: Array of search criteria objects
 * - options: Global search options
 */
export async function POST(request: NextRequest) {
  const requestId = `compat_batch_search_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    console.log(`🔍 LI.FI compatible batch token search request ${requestId} started`);

    const body = await request.json();

    // Batch search schema (maintaining original format)
    const BatchSearchSchema = z.object({
      searches: z.array(z.object({
        symbol: z.string().optional(),
        chain: z.number().optional(),
        limit: z.number().default(20),
      })),
      options: z.object({
        deduplicateByAddress: z.boolean().default(true),
        sortBy: z.enum(["symbol", "chainId", "name"]).default("symbol"),
      }).optional(),
    });

    const validatedBody = BatchSearchSchema.parse(body);

    console.log(`📋 LI.FI compatible batch search for ${validatedBody.searches.length} queries`);

    // Convert searches to multi-provider format and execute
    const searchPromises = validatedBody.searches.map(async (searchParams) => {
      try {
        const result = await tokenQueryEngine.searchTokens({
          symbol: searchParams.symbol,
          chainIds: searchParams.chain ? [searchParams.chain] : undefined,
          limit: searchParams.limit,
          providers: ['lifi', 'local', 'relay'] as any,
          deduplicate: true,
        });
        return result.tokens;
      } catch (error) {
        console.error(`❌ Individual compatible search failed:`, error);
        return [];
      }
    });

    const searchResults = await Promise.all(searchPromises);
    let allTokens = searchResults.flat();

    // Apply deduplication if requested
    if (validatedBody.options?.deduplicateByAddress) {
      const seen = new Set<string>();
      allTokens = allTokens.filter(token => {
        const key = `${token.address.toLowerCase()}_${token.chainId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    // Apply sorting
    const sortBy = validatedBody.options?.sortBy || "symbol";
    allTokens.sort((a, b) => {
      if (sortBy === "chainId") return a.chainId - b.chainId;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return a.symbol.localeCompare(b.symbol);
    });

    // Convert to legacy format
    const legacyTokens = allTokens.map(convertToLegacyFormat);

    console.log(`✅ LI.FI compatible batch token search ${requestId} completed: ${legacyTokens.length} unique tokens`);

    const response: TokenSearchResponse = {
      success: true,
      data: {
        tokens: legacyTokens,
        count: legacyTokens.length,
        requestId,
      },
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "X-Request-ID": requestId,
        "X-Powered-By": "Multi-Provider-System",
        "X-Compatibility-Mode": "lifi-legacy",
      },
    });

  } catch (error) {
    console.error(`❌ LI.FI compatible batch token search ${requestId} failed:`, error);

    const response: TokenSearchResponse = {
      success: false,
      error: {
        code: "BATCH_SEARCH_ERROR",
        message: "Batch token search failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
    };

    return NextResponse.json(response, {
      status: 500,
      headers: { "X-Request-ID": requestId },
    });
  }
}