// RPC fallback and retry logic

import type {
  RpcEndpoint,
  RpcProvider,
  RpcFallbackResult,
  RpcHealthStatus,
} from './types';

// Health check cache (in-memory, resets on reload)
const healthStatusCache = new Map<string, RpcHealthStatus>();

// Configuration from environment
const RPC_TIMEOUT = parseInt(
  process.env.NEXT_PUBLIC_RPC_TIMEOUT_MS || '5000',
  10
);
const MAX_RETRY_ATTEMPTS = parseInt(
  process.env.NEXT_PUBLIC_RPC_MAX_RETRY_ATTEMPTS || '3',
  10
);
const HEALTH_CHECK_INTERVAL = parseInt(
  process.env.NEXT_PUBLIC_RPC_HEALTH_CHECK_INTERVAL_MS || '300000',
  10
);

/**
 * Get health status for an RPC endpoint
 */
export function getHealthStatus(url: string): RpcHealthStatus | undefined {
  return healthStatusCache.get(url);
}

/**
 * Update health status for an RPC endpoint
 */
export function updateHealthStatus(
  url: string,
  provider: RpcProvider,
  isHealthy: boolean,
  error?: string,
  latency?: number
): void {
  const existing = healthStatusCache.get(url);

  healthStatusCache.set(url, {
    provider,
    url,
    isHealthy,
    lastChecked: Date.now(),
    latency,
    errorCount: isHealthy ? 0 : (existing?.errorCount || 0) + 1,
    lastError: error,
  });
}

/**
 * Check if health status is stale
 */
function isHealthStatusStale(status: RpcHealthStatus): boolean {
  return Date.now() - status.lastChecked > HEALTH_CHECK_INTERVAL;
}

/**
 * Sort endpoints by priority and health status
 */
export function sortEndpointsByPreference(
  endpoints: RpcEndpoint[]
): RpcEndpoint[] {
  return [...endpoints].sort((a, b) => {
    const aHealth = getHealthStatus(a.url);
    const bHealth = getHealthStatus(b.url);

    // Deprioritize unhealthy endpoints
    if (aHealth && !aHealth.isHealthy && !isHealthStatusStale(aHealth)) {
      return 1;
    }
    if (bHealth && !bHealth.isHealthy && !isHealthStatusStale(bHealth)) {
      return -1;
    }

    // Otherwise sort by priority
    return a.priority - b.priority;
  });
}

/**
 * Execute RPC call with fallback logic
 */
export async function executeWithFallback<T>(
  endpoints: RpcEndpoint[],
  rpcCall: (url: string) => Promise<T>,
  options?: {
    timeout?: number;
    maxRetries?: number;
  }
): Promise<RpcFallbackResult<T>> {
  const timeout = options?.timeout || RPC_TIMEOUT;
  const maxRetries = options?.maxRetries || MAX_RETRY_ATTEMPTS;
  const attemptedProviders: string[] = [];

  // Sort endpoints by health and priority
  const sortedEndpoints = sortEndpointsByPreference(endpoints);

  for (const endpoint of sortedEndpoints) {
    attemptedProviders.push(`${endpoint.provider}:${endpoint.url}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();

        // Execute with timeout
        const result = await Promise.race<T>([
          rpcCall(endpoint.url),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`RPC timeout after ${timeout}ms`)),
              timeout
            )
          ),
        ]);

        const latency = Date.now() - startTime;

        // Update health status on success
        updateHealthStatus(endpoint.url, endpoint.provider, true, undefined, latency);

        console.log(
          `✅ RPC success: ${endpoint.provider} (${latency}ms, attempt ${attempt}/${maxRetries})`
        );

        return {
          success: true,
          data: result,
          provider: endpoint.provider,
          url: endpoint.url,
          attemptedProviders,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        console.warn(
          `⚠️  RPC attempt ${attempt}/${maxRetries} failed for ${endpoint.provider}: ${errorMsg}`
        );

        // Update health status on final attempt failure
        if (attempt === maxRetries) {
          updateHealthStatus(endpoint.url, endpoint.provider, false, errorMsg);
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(1000 * attempt, 5000))
          );
        }
      }
    }
  }

  // All endpoints failed
  console.error(
    `❌ All RPC providers failed. Attempted: ${attemptedProviders.join(', ')}`
  );

  return {
    success: false,
    error: new Error('All RPC providers failed'),
    attemptedProviders,
  };
}

/**
 * Clear health status cache (useful for testing or manual resets)
 */
export function clearHealthCache(): void {
  healthStatusCache.clear();
  console.log('🔄 RPC health cache cleared');
}

/**
 * Get all health statuses (for debugging/monitoring)
 */
export function getAllHealthStatuses(): RpcHealthStatus[] {
  return Array.from(healthStatusCache.values());
}
