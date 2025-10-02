// lib/token-providers/base-provider.ts - Abstract base class for token providers

import type { TokenProvider, TokenSearchParams, HealthStatus, ProviderName } from '@/types/provider-types';
import type { UnifiedToken } from '@/types/unified-token';

/**
 * Abstract base class for all token providers
 * Provides common functionality and enforces interface compliance
 */
export abstract class BaseTokenProvider implements TokenProvider {
  public abstract readonly name: ProviderName;
  public abstract readonly priority: number;
  public readonly enabled: boolean;

  private healthCache: HealthStatus | null = null;
  private readonly healthCacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  /**
   * Abstract method that must be implemented by all providers
   */
  public abstract searchTokens(params: TokenSearchParams): Promise<UnifiedToken[]>;

  /**
   * Optional method for getting detailed token information
   */
  public async getTokenDetails?(address: string, chainId: number): Promise<UnifiedToken | null> {
    // Default implementation returns null
    return null;
  }

  /**
   * Health check with caching
   */
  public async healthCheck(): Promise<boolean> {
    // Check cache first
    if (this.healthCache && this.isHealthCacheValid()) {
      return this.healthCache.healthy;
    }

    const startTime = Date.now();
    let healthy = false;
    let error: string | undefined;

    try {
      healthy = await this.performHealthCheck();
    } catch (err) {
      healthy = false;
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const responseTime = Date.now() - startTime;

    // Update cache
    this.healthCache = {
      healthy,
      lastCheck: new Date(),
      responseTime,
      error,
    };

    return healthy;
  }

  /**
   * Get current health status from cache
   */
  public getHealthStatus(): HealthStatus | null {
    return this.healthCache;
  }

  /**
   * Clear health cache
   */
  public clearHealthCache(): void {
    this.healthCache = null;
  }

  /**
   * Default health check implementation - can be overridden
   */
  protected async performHealthCheck(): Promise<boolean> {
    try {
      // Perform a simple token search to test the provider
      const result = await this.searchTokens({ symbol: 'ETH', limit: 1 });
      return Array.isArray(result);
    } catch {
      return false;
    }
  }

  /**
   * Check if health cache is still valid
   */
  private isHealthCacheValid(): boolean {
    if (!this.healthCache) return false;
    const age = Date.now() - this.healthCache.lastCheck.getTime();
    return age < this.healthCacheTTL;
  }

  /**
   * Helper method to create a consistent error response
   */
  protected createErrorResponse(error: string): never {
    throw new Error(`${this.name} provider error: ${error}`);
  }

  /**
   * Helper method to validate search parameters
   */
  protected validateSearchParams(params: TokenSearchParams): void {
    if (!params.symbol && (!params.chainIds || params.chainIds.length === 0)) {
      throw new Error('Either symbol or chainIds must be provided');
    }

    if (params.limit && (params.limit < 1 || params.limit > 100)) {
      throw new Error('Limit must be between 1 and 100');
    }
  }

  /**
   * Helper method to calculate confidence score based on provider priority and data quality
   */
  protected calculateConfidence(hasPrice: boolean, hasLogo: boolean, verified: boolean): number {
    let confidence = this.priority; // Start with provider priority (0-100)

    // Adjust based on data quality
    if (hasPrice) confidence += 10;
    if (hasLogo) confidence += 5;
    if (verified) confidence += 15;

    // Cap at 100
    return Math.min(confidence, 100);
  }
}