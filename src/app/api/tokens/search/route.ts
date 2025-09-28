// app/api/tokens/search/route.ts - Unified multi-provider token search API

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { tokenQueryEngine } from "@/lib/token-query-engine";
import { tokenMerger } from "@/lib/token-merger";
import { providerHealthMonitor } from "@/lib/provider-health";
import {
  tokenProviderRegistry,
  lifiTokenProvider,
  relayTokenProvider,
  localTokenProvider
} from "@/lib/token-providers";
import type { MultiProviderTokenResponse } from "@/types/unified-token";

// Initialize providers
if (!tokenProviderRegistry.isProviderActive('lifi')) {
  tokenProviderRegistry.register(lifiTokenProvider);
}
if (!tokenProviderRegistry.isProviderActive('relay')) {
  tokenProviderRegistry.register(relayTokenProvider);
}
if (!tokenProviderRegistry.isProviderActive('local')) {
  tokenProviderRegistry.register(localTokenProvider);
}

// Request validation schema
const TokenSearchRequestSchema = z.object({
  symbol: z.string().min(1).max(20).optional(),
  chainIds: z.array(z.number().int().positive()).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  providers: z.array(z.enum(['lifi', 'relay', 'local', 'coingecko'])).optional(),
  excludeProviders: z.array(z.enum(['lifi', 'relay', 'local', 'coingecko'])).optional(),
  deduplicate: z.boolean().default(true),
  sortBy: z.enum(['symbol', 'chainId', 'name', 'confidence', 'priority']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  includeMetadata: z.boolean().default(true),
  includeHealth: z.boolean().default(false),
});

export type TokenSearchRequest = z.infer<typeof TokenSearchRequestSchema>;

/**
 * GET /api/tokens/search
 *
 * Unified multi-provider token search endpoint
 *
 * Query Parameters:
 * - symbol (optional): Token symbol to search for
 * - chainIds (optional): Array of chain IDs to filter results (comma-separated)
 * - limit (optional): Maximum number of results (default: 20, max: 100)
 * - providers (optional): Specific providers to query (comma-separated)
 * - excludeProviders (optional): Providers to exclude (comma-separated)
 * - deduplicate (optional): Remove duplicate tokens (default: true)
 * - sortBy (optional): Sort criteria (symbol, chainId, confidence, etc.)
 * - sortOrder (optional): Sort order (asc, desc, default: desc)
 * - includeMetadata (optional): Include provider-specific metadata (default: true)
 * - includeHealth (optional): Include provider health status (default: false)
 *
 * Returns:
 * - tokens: Array of unified tokens with provider attribution
 * - metadata: Query metadata (timing, provider stats, etc.)
 * - providerSummary: Per-provider performance summary
 * - health: Provider health status (if requested)
 */
export async function GET(request: NextRequest) {
  const requestId = `unified_search_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const startTime = Date.now();

  try {
    console.log(`🔍 Unified token search request ${requestId} started`);

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const rawParams = {
      symbol: searchParams.get("symbol") || undefined,
      chainIds: searchParams.get("chainIds")
        ? searchParams.get("chainIds")!.split(',').map(id => parseInt(id.trim()))
        : undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
      providers: searchParams.get("providers")
        ? searchParams.get("providers")!.split(',').map(p => p.trim())
        : undefined,
      excludeProviders: searchParams.get("excludeProviders")
        ? searchParams.get("excludeProviders")!.split(',').map(p => p.trim())
        : undefined,
      deduplicate: searchParams.get("deduplicate") !== 'false',
      sortBy: searchParams.get("sortBy") || undefined,
      sortOrder: searchParams.get("sortOrder") || 'desc',
      includeMetadata: searchParams.get("includeMetadata") !== 'false',
      includeHealth: searchParams.get("includeHealth") === 'true',
    };

    console.log(`📋 Multi-provider search parameters:`, rawParams);

    // Validate request parameters
    const validatedParams = TokenSearchRequestSchema.parse(rawParams);

    // Validate that we have search criteria
    if (!validatedParams.symbol && (!validatedParams.chainIds || validatedParams.chainIds.length === 0)) {
      const response: MultiProviderTokenResponse = {
        success: false,
        tokens: [],
        metadata: {
          totalResults: 0,
          providersQueried: [],
          providersSuccessful: [],
          providersFailed: [],
          averageConfidence: 0,
          queryTime: Date.now() - startTime,
          cacheHit: false,
        },
        providerSummary: {},
      };

      (response as any).error = {
        code: "MISSING_PARAMETERS",
        message: "Either 'symbol' or 'chainIds' parameter is required",
      };

      return NextResponse.json(response, { status: 400 });
    }

    // Execute multi-provider search
    console.log(`🚀 Executing multi-provider search across ${tokenProviderRegistry.getActiveProviders().length} providers`);

    const searchResult = await tokenQueryEngine.searchTokens({
      symbol: validatedParams.symbol,
      chainIds: validatedParams.chainIds,
      limit: validatedParams.limit * 2, // Get more results for better merging
      providers: validatedParams.providers,
      excludeProviders: validatedParams.excludeProviders,
      deduplicate: validatedParams.deduplicate,
      sortBy: validatedParams.sortBy,
      sortOrder: validatedParams.sortOrder,
    });

    // Apply intelligent merging if we have results from multiple providers
    let finalTokens = searchResult.tokens;
    let mergeStats = undefined;

    if (searchResult.tokens.length > 0 && validatedParams.deduplicate) {
      console.log(`🔄 Applying intelligent token merging to ${searchResult.tokens.length} tokens`);
      const mergeResult = tokenMerger.mergeTokens(searchResult.tokens);
      finalTokens = mergeResult.mergedTokens;
      mergeStats = mergeResult.statistics;

      console.log(`✅ Token merging completed:`, {
        original: mergeStats.originalCount,
        final: mergeStats.finalCount,
        deduplicated: mergeStats.deduplicatedCount,
      });
    }

    // Apply final limit after merging
    if (finalTokens.length > validatedParams.limit) {
      finalTokens = finalTokens.slice(0, validatedParams.limit);
    }

    // Remove metadata if not requested
    if (!validatedParams.includeMetadata) {
      finalTokens = finalTokens.map(token => ({
        ...token,
        metadata: {},
      }));
    }

    // Get provider health if requested
    let healthStatus = undefined;
    if (validatedParams.includeHealth) {
      healthStatus = providerHealthMonitor.getAllProviderHealth();
    }

    const queryTime = Date.now() - startTime;

    // Build response
    const response: MultiProviderTokenResponse = {
      success: true,
      tokens: finalTokens,
      metadata: {
        totalResults: finalTokens.length,
        providersQueried: searchResult.metadata.providersQueried,
        providersSuccessful: searchResult.metadata.providersSuccessful,
        providersFailed: searchResult.metadata.providersFailed,
        averageConfidence: finalTokens.length > 0
          ? Math.round(finalTokens.reduce((sum, token) => sum + token.confidence, 0) / finalTokens.length)
          : 0,
        queryTime,
        cacheHit: searchResult.metadata.cacheHit,
      },
      providerSummary: Object.fromEntries(
        Object.entries(searchResult.providerSummary).map(([provider, summary]) => [
          provider,
          {
            results: summary?.results || 0,
            responseTime: summary?.responseTime || 0,
            status: summary?.status || 'unknown',
            error: summary?.error,
          }
        ])
      ),
    };

    // Add health data if requested
    if (validatedParams.includeHealth && healthStatus) {
      (response as any).health = Object.fromEntries(
        Array.from(healthStatus.entries()).map(([provider, health]) => [
          provider,
          {
            status: health.status,
            healthy: health.healthy,
            lastCheck: health.lastCheck,
            responseTime: health.responseTime,
            error: health.error,
          }
        ])
      );
    }

    // Add merge statistics if available
    if (mergeStats) {
      (response as any).mergeStatistics = mergeStats;
    }

    console.log(`✅ Unified token search ${requestId} completed successfully:`, {
      totalTokens: finalTokens.length,
      providersSuccessful: searchResult.metadata.providersSuccessful.length,
      providersFailed: searchResult.metadata.providersFailed.length,
      queryTime,
      avgConfidence: response.metadata.averageConfidence,
    });

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600", // Cache for 5 minutes
        "X-Request-ID": requestId,
        "X-Provider-Count": searchResult.metadata.providersSuccessful.length.toString(),
        "X-Query-Time": queryTime.toString(),
      },
    });

  } catch (error) {
    const queryTime = Date.now() - startTime;
    console.error(`❌ Unified token search ${requestId} failed:`, error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      const response: MultiProviderTokenResponse = {
        success: false,
        tokens: [],
        metadata: {
          totalResults: 0,
          providersQueried: [],
          providersSuccessful: [],
          providersFailed: [],
          averageConfidence: 0,
          queryTime,
          cacheHit: false,
        },
        providerSummary: {},
      };

      (response as any).error = {
        code: "VALIDATION_ERROR",
        message: "Invalid request parameters",
        details: error.issues,
      };

      return NextResponse.json(response, {
        status: 400,
        headers: { "X-Request-ID": requestId },
      });
    }

    // Handle unexpected errors
    const response: MultiProviderTokenResponse = {
      success: false,
      tokens: [],
      metadata: {
        totalResults: 0,
        providersQueried: [],
        providersSuccessful: [],
        providersFailed: [],
        averageConfidence: 0,
        queryTime,
        cacheHit: false,
      },
      providerSummary: {},
    };

    (response as any).error = {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred during multi-provider token search",
      details: process.env.NODE_ENV === "development" ? {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      } : undefined,
    };

    return NextResponse.json(response, {
      status: 500,
      headers: { "X-Request-ID": requestId },
    });
  }
}

/**
 * POST /api/tokens/search
 *
 * Advanced multi-provider token search with complex criteria
 *
 * Body:
 * - searches: Array of search criteria objects
 * - options: Global search and merge options
 */
export async function POST(request: NextRequest) {
  const requestId = `batch_unified_search_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const startTime = Date.now();

  try {
    console.log(`🔍 Batch unified token search request ${requestId} started`);

    const body = await request.json();

    // Batch search schema
    const BatchSearchSchema = z.object({
      searches: z.array(TokenSearchRequestSchema),
      options: z.object({
        mergeAcrossBatches: z.boolean().default(false),
        globalDeduplication: z.boolean().default(true),
        globalSortBy: z.enum(['symbol', 'chainId', 'confidence']).optional(),
        includeHealth: z.boolean().default(false),
      }).optional(),
    });

    const validatedBody = BatchSearchSchema.parse(body);

    console.log(`📋 Batch search for ${validatedBody.searches.length} queries`);

    // Execute all searches in parallel
    const searchPromises = validatedBody.searches.map(async (searchParams, index) => {
      try {
        const result = await tokenQueryEngine.searchTokens({
          symbol: searchParams.symbol,
          chainIds: searchParams.chainIds,
          limit: searchParams.limit,
          providers: searchParams.providers,
          excludeProviders: searchParams.excludeProviders,
          deduplicate: searchParams.deduplicate,
          sortBy: searchParams.sortBy,
          sortOrder: searchParams.sortOrder,
        });
        return { index, success: true, result };
      } catch (error) {
        console.error(`❌ Batch search ${index} failed:`, error);
        return {
          index,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    const searchResults = await Promise.all(searchPromises);

    // Collect all successful results
    const allTokens = searchResults
      .filter(result => result.success)
      .flatMap(result => (result as any).result.tokens);

    // Apply global merge if requested
    let finalTokens = allTokens;
    if (validatedBody.options?.mergeAcrossBatches && allTokens.length > 0) {
      const mergeResult = tokenMerger.mergeTokens(allTokens);
      finalTokens = mergeResult.mergedTokens;
    }

    // Apply global sorting if specified
    if (validatedBody.options?.globalSortBy) {
      finalTokens.sort((a, b) => {
        const sortBy = validatedBody.options!.globalSortBy!;
        if (sortBy === 'chainId') return a.chainId - b.chainId;
        if (sortBy === 'confidence') return b.confidence - a.confidence;
        return a.symbol.localeCompare(b.symbol);
      });
    }

    const queryTime = Date.now() - startTime;

    const response: MultiProviderTokenResponse = {
      success: true,
      tokens: finalTokens,
      metadata: {
        totalResults: finalTokens.length,
        providersQueried: [...new Set(searchResults.flatMap(r =>
          r.success ? (r as any).result.metadata.providersQueried : []
        ))],
        providersSuccessful: [...new Set(searchResults.flatMap(r =>
          r.success ? (r as any).result.metadata.providersSuccessful : []
        ))],
        providersFailed: [...new Set(searchResults.flatMap(r =>
          r.success ? (r as any).result.metadata.providersFailed : []
        ))],
        averageConfidence: finalTokens.length > 0
          ? Math.round(finalTokens.reduce((sum, token) => sum + token.confidence, 0) / finalTokens.length)
          : 0,
        queryTime,
        cacheHit: false,
      },
      providerSummary: {},
    };

    console.log(`✅ Batch unified token search ${requestId} completed: ${finalTokens.length} unique tokens`);

    return NextResponse.json(response, {
      status: 200,
      headers: { "X-Request-ID": requestId },
    });

  } catch (error) {
    console.error(`❌ Batch unified token search ${requestId} failed:`, error);

    const response: MultiProviderTokenResponse = {
      success: false,
      tokens: [],
      metadata: {
        totalResults: 0,
        providersQueried: [],
        providersSuccessful: [],
        providersFailed: [],
        averageConfidence: 0,
        queryTime: Date.now() - startTime,
        cacheHit: false,
      },
      providerSummary: {},
    };

    (response as any).error = {
      code: "BATCH_SEARCH_ERROR",
      message: "Batch unified token search failed",
      details: error instanceof Error ? error.message : "Unknown error",
    };

    return NextResponse.json(response, {
      status: 500,
      headers: { "X-Request-ID": requestId },
    });
  }
}