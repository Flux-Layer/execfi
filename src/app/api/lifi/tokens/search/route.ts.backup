// app/api/lifi/tokens/search/route.ts - Token search API endpoint

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchTokens, LifiError } from "@/lib/lifi-client";

// Request validation schema
const TokenSearchRequestSchema = z.object({
  symbol: z.string().min(1).max(20).optional(),
  chain: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

// Response schema for client-side validation
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
      priceUSD: z.string().optional(),
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
 * GET /api/lifi/tokens/search
 *
 * Search for tokens across multiple chains using LI.FI
 *
 * Query Parameters:
 * - symbol (optional): Token symbol to search for
 * - chain (optional): Specific chain ID to filter results
 * - limit (optional): Maximum number of results (default: 20, max: 100)
 *
 * Returns:
 * - tokens: Array of matching tokens with chain information
 * - count: Number of tokens returned
 * - requestId: Unique identifier for this search request
 */
export async function GET(request: NextRequest) {
  const requestId = `search_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    console.log(`🔍 Token search request ${requestId} started`);

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const rawParams = {
      symbol: searchParams.get("symbol") || undefined,
      chain: searchParams.get("chain") ? parseInt(searchParams.get("chain")!) : undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
    };

    console.log(`📋 Search parameters:`, rawParams);

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

    // Call LI.FI token search API
    const lifiResponse = await searchTokens({
      symbol: validatedParams.symbol,
      chain: validatedParams.chain,
      limit: validatedParams.limit,
    });

    console.log(`✅ LI.FI returned ${lifiResponse.tokens.length} tokens`);

    // Enhance response with chain names and verification status
    const enhancedTokens = lifiResponse.tokens.map(token => ({
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      chainId: token.chainId,
      chainName: CHAIN_NAMES[token.chainId] || `Chain ${token.chainId}`,
      decimals: token.decimals,
      logoURI: token.logoURI,
      verified: true, // LI.FI tokens are generally verified
      priceUSD: token.priceUSD,
    }));

    // Log successful search
    console.log(`✅ Token search ${requestId} completed successfully:`, {
      symbol: validatedParams.symbol,
      chain: validatedParams.chain,
      resultCount: enhancedTokens.length,
    });

    const response: TokenSearchResponse = {
      success: true,
      data: {
        tokens: enhancedTokens,
        count: enhancedTokens.length,
        requestId,
      },
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600", // Cache for 5 minutes
        "X-Request-ID": requestId,
      },
    });

  } catch (error) {
    console.error(`❌ Token search ${requestId} failed:`, error);

    // Handle LI.FI specific errors
    if (error instanceof LifiError) {
      const response: TokenSearchResponse = {
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
 * Batch search for multiple tokens or complex search criteria
 *
 * Body:
 * - searches: Array of search criteria objects
 * - options: Global search options
 */
export async function POST(request: NextRequest) {
  const requestId = `batch_search_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    console.log(`🔍 Batch token search request ${requestId} started`);

    const body = await request.json();

    // Batch search schema
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

    console.log(`📋 Batch search for ${validatedBody.searches.length} queries`);

    // Execute all searches in parallel
    const searchPromises = validatedBody.searches.map(async (searchParams) => {
      try {
        const result = await searchTokens(searchParams);
        return result.tokens;
      } catch (error) {
        console.error(`❌ Individual search failed:`, error);
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

    // Enhance with chain names
    const enhancedTokens = allTokens.map(token => ({
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      chainId: token.chainId,
      chainName: CHAIN_NAMES[token.chainId] || `Chain ${token.chainId}`,
      decimals: token.decimals,
      logoURI: token.logoURI,
      verified: true,
      priceUSD: token.priceUSD,
    }));

    console.log(`✅ Batch token search ${requestId} completed: ${enhancedTokens.length} unique tokens`);

    const response: TokenSearchResponse = {
      success: true,
      data: {
        tokens: enhancedTokens,
        count: enhancedTokens.length,
        requestId,
      },
    };

    return NextResponse.json(response, {
      status: 200,
      headers: { "X-Request-ID": requestId },
    });

  } catch (error) {
    console.error(`❌ Batch token search ${requestId} failed:`, error);

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