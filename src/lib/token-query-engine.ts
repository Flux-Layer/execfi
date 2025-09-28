// lib/token-query-engine.ts - Core multi-provider query orchestrator

import { tokenProviderRegistry } from "./token-providers/registry";
import type { TokenSearchParams } from "@/types/provider-types";
import type { UnifiedToken, MultiProviderResult } from "@/types/unified-token";

/**
 * Enhanced search parameters for the query engine
 */
export interface QueryEngineParams extends TokenSearchParams {
  // Provider selection
  providers?: string[]; // Specific providers to query
  excludeProviders?: string[]; // Providers to exclude

  // Response options
  deduplicate?: boolean; // Remove duplicate tokens (default: true)
  sortBy?: "symbol" | "chainId" | "name" | "confidence" | "priority";
  sortOrder?: "asc" | "desc";

  // Performance options
  timeout?: number; // Override default timeout
  maxResults?: number; // Limit total results
}

/**
 * Query configuration for the engine
 */
export interface QueryEngineConfig {
  defaultTimeout: number;
  maxConcurrentProviders: number;
  enableCaching: boolean;
  cacheTTL: number;
}

/**
 * Token Query Engine - orchestrates multi-provider token searches
 */
export class TokenQueryEngine {
  private config: QueryEngineConfig;
  private cache = new Map<
    string,
    { result: MultiProviderResult; timestamp: number }
  >();

  constructor(config?: Partial<QueryEngineConfig>) {
    this.config = {
      defaultTimeout: 5000,
      maxConcurrentProviders: 10,
      enableCaching: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      ...config,
    };
  }

  /**
   * Main search method - orchestrates multi-provider queries
   */
  public async searchTokens(
    params: QueryEngineParams,
  ): Promise<MultiProviderResult> {
    const startTime = Date.now();

    // Generate cache key
    const cacheKey = this.generateCacheKey(params);

    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log(`💾 Cache hit for token search: ${cacheKey}`);
        return {
          ...cached,
          metadata: {
            ...cached.metadata,
            cacheHit: true,
          },
        };
      }
    }

    console.log(`🔍 Starting multi-provider token search:`, params);

    try {
      // Get active providers based on parameters
      const activeProviders = this.selectProviders(params);
      console.log({ activeProviders });

      if (activeProviders.length === 0) {
        return this.createEmptyResult(
          startTime,
          "No active providers available",
        );
      }

      // Convert QueryEngineParams to TokenSearchParams for providers
      const providerParams: TokenSearchParams = {
        symbol: params.symbol,
        chainIds: params.chainIds,
        limit: params.limit,
        address: params.address,
      };

      console.log({ providerParams });

      // Execute multi-provider search
      const result = await tokenProviderRegistry.searchAll(providerParams);
      console.log({ result });

      // Apply query engine enhancements
      const enhancedResult = await this.enhanceResult(result, params);
      console.log({ enhancedResult });

      // Cache the result
      if (this.config.enableCaching && enhancedResult.success) {
        this.setCache(cacheKey, enhancedResult);
      }

      const totalTime = Date.now() - startTime;
      console.log(`✅ Multi-provider search completed in ${totalTime}ms:`, {
        providers: enhancedResult.metadata.providersSuccessful.length,
        tokens: enhancedResult.tokens.length,
        confidence: Math.round(enhancedResult.metadata.averageConfidence),
      });

      return enhancedResult;
    } catch (error) {
      console.error(`❌ Multi-provider search failed:`, error);
      return this.createEmptyResult(
        startTime,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Search for a specific token by address
   */
  public async getTokenByAddress(
    address: string,
    chainId: number,
  ): Promise<UnifiedToken | null> {
    const result = await this.searchTokens({
      address,
      chainIds: [chainId],
      limit: 1,
    });

    return result.tokens.length > 0 ? result.tokens[0] : null;
  }

  /**
   * Batch search for multiple tokens
   */
  public async batchSearch(
    searches: QueryEngineParams[],
  ): Promise<MultiProviderResult[]> {
    const batchPromises = searches.map((params) => this.searchTokens(params));
    return Promise.all(batchPromises);
  }

  /**
   * Get provider health status
   */
  public async getProviderHealth(): Promise<{ [provider: string]: boolean }> {
    return tokenProviderRegistry.healthCheckAll();
  }

  /**
   * Clear the cache
   */
  public clearCache(): void {
    this.cache.clear();
    console.log("🧹 Token query engine cache cleared");
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; hitRate: number } {
    // TODO: Implement hit rate tracking
    return {
      size: this.cache.size,
      hitRate: 0, // Placeholder
    };
  }

  /**
   * Select providers based on query parameters
   */
  private selectProviders(params: QueryEngineParams) {
    let providers = tokenProviderRegistry.getActiveProviders();

    // Filter by specific providers if requested
    if (params.providers && params.providers.length > 0) {
      providers = providers.filter((p) => params.providers!.includes(p.name));
    }

    // Exclude specific providers if requested
    if (params.excludeProviders && params.excludeProviders.length > 0) {
      providers = providers.filter(
        (p) => !params.excludeProviders!.includes(p.name),
      );
    }

    // Limit concurrent providers
    if (providers.length > this.config.maxConcurrentProviders) {
      providers = providers.slice(0, this.config.maxConcurrentProviders);
      console.warn(
        `⚠️ Limited to ${this.config.maxConcurrentProviders} concurrent providers`,
      );
    }

    return providers;
  }

  /**
   * Enhance the multi-provider result with additional processing
   */
  private async enhanceResult(
    result: MultiProviderResult,
    params: QueryEngineParams,
  ): Promise<MultiProviderResult> {
    let tokens = result.tokens;

    // Apply deduplication if requested (default: true)
    if (params.deduplicate !== false) {
      tokens = this.deduplicateTokens(tokens);
    }

    // Apply sorting if requested
    if (params.sortBy) {
      tokens = this.sortTokens(
        tokens,
        params.sortBy,
        params.sortOrder || "desc",
      );
    }

    // Apply max results limit
    if (params.maxResults && tokens.length > params.maxResults) {
      tokens = tokens.slice(0, params.maxResults);
    }

    return {
      ...result,
      tokens,
      metadata: {
        ...result.metadata,
        totalResults: tokens.length,
      },
    };
  }

  /**
   * Remove duplicate tokens based on address + chainId
   */
  private deduplicateTokens(tokens: UnifiedToken[]): UnifiedToken[] {
    const seen = new Map<string, UnifiedToken>();

    tokens.forEach((token) => {
      const key = `${token.address.toLowerCase()}_${token.chainId}`;
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, token);
      } else {
        // Keep the token with higher confidence or more sources
        if (
          token.confidence > existing.confidence ||
          token.sources.length > existing.sources.length
        ) {
          // Merge sources and metadata
          const merged: UnifiedToken = {
            ...token,
            sources: [...new Set([...existing.sources, ...token.sources])],
            metadata: {
              ...existing.metadata,
              ...token.metadata,
            },
          };
          seen.set(key, merged);
        }
      }
    });

    return Array.from(seen.values());
  }

  /**
   * Sort tokens by specified criteria
   */
  private sortTokens(
    tokens: UnifiedToken[],
    sortBy: NonNullable<QueryEngineParams["sortBy"]>,
    order: "asc" | "desc",
  ): UnifiedToken[] {
    const sorted = [...tokens].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "symbol":
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case "chainId":
          comparison = a.chainId - b.chainId;
          break;
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "confidence":
          comparison = a.confidence - b.confidence;
          break;
        case "priority":
          // Sort by highest priority provider in sources
          const aPriority = Math.max(
            ...a.sources.map((s) => this.getProviderPriority(s)),
          );
          const bPriority = Math.max(
            ...b.sources.map((s) => this.getProviderPriority(s)),
          );
          comparison = aPriority - bPriority;
          break;
      }

      return order === "asc" ? comparison : -comparison;
    });

    return sorted;
  }

  /**
   * Get provider priority for sorting
   */
  private getProviderPriority(providerName: string): number {
    const provider = tokenProviderRegistry.getProvider(providerName as any);
    return provider?.priority || 0;
  }

  /**
   * Generate cache key from search parameters
   */
  private generateCacheKey(params: QueryEngineParams): string {
    const keyParts = [
      params.symbol || "",
      (params.chainIds || []).sort().join(","),
      params.limit || "",
      params.address || "",
      (params.providers || []).sort().join(","),
      (params.excludeProviders || []).sort().join(","),
    ];
    return keyParts.join("|");
  }

  /**
   * Get result from cache if valid
   */
  private getFromCache(key: string): MultiProviderResult | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.config.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.result;
  }

  /**
   * Store result in cache
   */
  private setCache(key: string, result: MultiProviderResult): void {
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });

    // Simple cache cleanup - remove old entries if cache gets too large
    if (this.cache.size > 1000) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * Create an empty result for error cases
   */
  private createEmptyResult(
    startTime: number,
    error?: string,
  ): MultiProviderResult {
    return {
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
  }
}

// Export singleton instance
export const tokenQueryEngine = new TokenQueryEngine();
