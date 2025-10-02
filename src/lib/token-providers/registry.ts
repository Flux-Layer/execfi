// lib/token-providers/registry.ts - Token provider registry system

import type { TokenProvider, TokenSearchParams, ProviderName } from '@/types/provider-types';
import type { UnifiedToken, MultiProviderResult } from '@/types/unified-token';

/**
 * Registry for managing token providers
 */
export class TokenProviderRegistry {
  private providers = new Map<ProviderName, TokenProvider>();
  private readonly defaultTimeout = 5000; // 5 seconds

  /**
   * Register a new token provider
   */
  public register(provider: TokenProvider): void {
    if (this.providers.has(provider.name)) {
      console.warn(`Provider ${provider.name} is already registered. Overwriting...`);
    }

    this.providers.set(provider.name, provider);
    console.log(`✅ Registered token provider: ${provider.name} (priority: ${provider.priority}, enabled: ${provider.enabled})`);
  }

  /**
   * Unregister a provider
   */
  public unregister(providerName: ProviderName): boolean {
    const removed = this.providers.delete(providerName);
    if (removed) {
      console.log(`❌ Unregistered token provider: ${providerName}`);
    }
    return removed;
  }

  /**
   * Get a specific provider
   */
  public getProvider(providerName: ProviderName): TokenProvider | undefined {
    return this.providers.get(providerName);
  }

  /**
   * Get all active (enabled) providers sorted by priority
   */
  public getActiveProviders(): TokenProvider[] {
    return Array.from(this.providers.values())
      .filter(provider => provider.enabled)
      .sort((a, b) => b.priority - a.priority); // Sort by priority descending
  }

  /**
   * Get all registered providers (including disabled ones)
   */
  public getAllProviders(): TokenProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Check if a provider is registered and enabled
   */
  public isProviderActive(providerName: ProviderName): boolean {
    const provider = this.providers.get(providerName);
    return provider !== undefined && provider.enabled;
  }

  /**
   * Get provider count statistics
   */
  public getStats(): { total: number; active: number; disabled: number } {
    const total = this.providers.size;
    const active = this.getActiveProviders().length;
    const disabled = total - active;

    return { total, active, disabled };
  }

  /**
   * Search tokens across all active providers
   */
  public async searchAll(params: TokenSearchParams): Promise<MultiProviderResult> {
    const startTime = Date.now();
    const activeProviders = this.getActiveProviders();

    if (activeProviders.length === 0) {
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

    console.log(`🔍 Searching ${activeProviders.length} providers for tokens:`, params);

    // Create provider search promises with timeout
    const providerPromises = activeProviders.map(async (provider) => {
      const providerStartTime = Date.now();

      try {
        // Add timeout to prevent hanging
        const searchPromise = provider.searchTokens(params);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Provider timeout')), this.defaultTimeout);
        });

        const tokens = await Promise.race([searchPromise, timeoutPromise]);
        const responseTime = Date.now() - providerStartTime;

        return {
          provider: provider.name,
          success: true,
          tokens: Array.isArray(tokens) ? tokens : [],
          responseTime,
        };
      } catch (error) {
        const responseTime = Date.now() - providerStartTime;
        return {
          provider: provider.name,
          success: false,
          tokens: [],
          error: error instanceof Error ? error.message : 'Unknown error',
          responseTime,
        };
      }
    });

    // Execute all provider searches in parallel
    const results = await Promise.allSettled(providerPromises);

    // Process results
    const providerResults = results.map((result, index) => {
      const provider = activeProviders[index];

      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          provider: provider.name,
          success: false,
          tokens: [],
          error: result.reason?.message || 'Promise rejected',
          responseTime: this.defaultTimeout,
        };
      }
    });

    // Collect all tokens and build metadata
    const allTokens: UnifiedToken[] = [];
    const providersQueried: ProviderName[] = [];
    const providersSuccessful: ProviderName[] = [];
    const providersFailed: ProviderName[] = [];
    const providerSummary: MultiProviderResult['providerSummary'] = {};

    let totalConfidence = 0;
    let tokenCount = 0;

    providerResults.forEach((result) => {
      providersQueried.push(result.provider);

      providerSummary[result.provider] = {
        results: result.tokens.length,
        responseTime: result.responseTime || 0,
        status: result.success ? 'success' : 'failed',
        error: result.error,
      };

      if (result.success) {
        providersSuccessful.push(result.provider);
        allTokens.push(...result.tokens);

        // Calculate running confidence average
        result.tokens.forEach(token => {
          totalConfidence += token.confidence || 0;
          tokenCount++;
        });
      } else {
        providersFailed.push(result.provider);
        console.warn(`❌ Provider ${result.provider} failed:`, result.error);
      }
    });

    const queryTime = Date.now() - startTime;
    const averageConfidence = tokenCount > 0 ? totalConfidence / tokenCount : 0;

    const multiProviderResult: MultiProviderResult = {
      success: providersSuccessful.length > 0,
      tokens: allTokens,
      metadata: {
        totalResults: allTokens.length,
        providersQueried,
        providersSuccessful,
        providersFailed,
        averageConfidence,
        queryTime,
        cacheHit: false, // TODO: Implement caching
      },
      providerSummary,
    };

    console.log(`✅ Multi-provider search completed in ${queryTime}ms:`, {
      totalTokens: allTokens.length,
      successful: providersSuccessful.length,
      failed: providersFailed.length,
      avgConfidence: Math.round(averageConfidence),
    });

    return multiProviderResult;
  }

  /**
   * Perform health check on all providers
   */
  public async healthCheckAll(): Promise<{ [key in ProviderName]?: boolean }> {
    const providers = this.getAllProviders();
    const healthPromises = providers.map(async (provider) => {
      try {
        const healthy = await provider.healthCheck?.();
        return { provider: provider.name, healthy: healthy ?? true };
      } catch {
        return { provider: provider.name, healthy: false };
      }
    });

    const results = await Promise.allSettled(healthPromises);
    const healthStatus: { [key in ProviderName]?: boolean } = {};

    results.forEach((result, index) => {
      const provider = providers[index];
      if (result.status === 'fulfilled') {
        healthStatus[provider.name] = result.value.healthy;
      } else {
        healthStatus[provider.name] = false;
      }
    });

    return healthStatus;
  }

  /**
   * Clear the registry (useful for testing)
   */
  public clear(): void {
    this.providers.clear();
    console.log('🧹 Cleared token provider registry');
  }
}

// Export singleton instance
export const tokenProviderRegistry = new TokenProviderRegistry();