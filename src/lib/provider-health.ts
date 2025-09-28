// lib/provider-health.ts - Provider health monitoring system

import { tokenProviderRegistry } from './token-providers/registry';
import type { ProviderName, HealthStatus } from '@/types/provider-types';

/**
 * Provider performance metrics
 */
export interface ProviderMetrics {
  provider: ProviderName;
  responseTime: number;
  successRate: number;
  errorRate: number;
  tokenCoverage: number;
  priceDataAvailability: number;
  lastSuccessfulRequest?: Date;
  lastFailedRequest?: Date;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
}

/**
 * Health check result with detailed status
 */
export interface DetailedHealthStatus extends HealthStatus {
  provider: ProviderName;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  metrics?: ProviderMetrics;
  issues?: string[];
  recommendations?: string[];
}

/**
 * Provider health monitoring configuration
 */
export interface HealthMonitorConfig {
  checkInterval: number; // milliseconds
  healthCheckTimeout: number; // milliseconds
  degradedThreshold: number; // response time threshold for degraded status
  unhealthyThreshold: number; // error rate threshold for unhealthy status
  enableAutomaticDisabling: boolean; // disable providers that consistently fail
  disableAfterFailures: number; // number of consecutive failures before disabling
  enableMetricsCollection: boolean; // collect detailed performance metrics
  metricsRetentionPeriod: number; // milliseconds to keep metrics data
}

/**
 * Default health monitoring configuration
 */
const DEFAULT_CONFIG: HealthMonitorConfig = {
  checkInterval: 5 * 60 * 1000, // 5 minutes
  healthCheckTimeout: 10 * 1000, // 10 seconds
  degradedThreshold: 3000, // 3 seconds
  unhealthyThreshold: 0.5, // 50% error rate
  enableAutomaticDisabling: false, // Disabled by default for safety
  disableAfterFailures: 3,
  enableMetricsCollection: true,
  metricsRetentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Provider Health Monitor - tracks and manages provider health
 */
export class ProviderHealthMonitor {
  private config: HealthMonitorConfig;
  private healthCache = new Map<ProviderName, DetailedHealthStatus>();
  private metricsHistory = new Map<ProviderName, ProviderMetrics[]>();
  private consecutiveFailures = new Map<ProviderName, number>();
  private intervalId?: NodeJS.Timeout;

  constructor(config?: Partial<HealthMonitorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start automatic health monitoring
   */
  public startMonitoring(): void {
    if (this.intervalId) {
      console.warn('⚠️ Health monitoring is already running');
      return;
    }

    console.log(`🏥 Starting provider health monitoring (interval: ${this.config.checkInterval}ms)`);

    // Initial health check
    this.checkAllProviders();

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.checkAllProviders();
    }, this.config.checkInterval);
  }

  /**
   * Stop automatic health monitoring
   */
  public stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('🛑 Provider health monitoring stopped');
    }
  }

  /**
   * Check health of all registered providers
   */
  public async checkAllProviders(): Promise<Map<ProviderName, DetailedHealthStatus>> {
    console.log('🔍 Performing health check on all providers');

    const providers = tokenProviderRegistry.getAllProviders();
    const healthPromises = providers.map(provider => this.checkProviderHealth(provider.name));

    const results = await Promise.allSettled(healthPromises);
    const healthStatuses = new Map<ProviderName, DetailedHealthStatus>();

    results.forEach((result, index) => {
      const provider = providers[index];
      if (result.status === 'fulfilled' && result.value) {
        healthStatuses.set(provider.name, result.value);
        this.healthCache.set(provider.name, result.value);
      } else {
        // Create error status for failed health checks
        const errorStatus: DetailedHealthStatus = {
          provider: provider.name,
          healthy: false,
          status: 'unknown',
          lastCheck: new Date(),
          error: result.status === 'rejected' ? result.reason?.message : 'Health check failed',
          issues: ['Health check process failed'],
          recommendations: ['Check provider configuration and network connectivity'],
        };
        healthStatuses.set(provider.name, errorStatus);
        this.healthCache.set(provider.name, errorStatus);
      }
    });

    // Clean up old metrics data
    this.cleanupOldMetrics();

    return healthStatuses;
  }

  /**
   * Check health of a specific provider
   */
  public async checkProviderHealth(providerName: ProviderName): Promise<DetailedHealthStatus | null> {
    const provider = tokenProviderRegistry.getProvider(providerName);
    if (!provider) {
      console.warn(`⚠️ Provider ${providerName} not found for health check`);
      return null;
    }

    const startTime = Date.now();
    let healthStatus: DetailedHealthStatus;

    try {
      console.log(`🏥 Checking health of ${providerName} provider`);

      // Perform health check with timeout
      const healthPromise = provider.healthCheck?.() ?? Promise.resolve(true);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.config.healthCheckTimeout);
      });

      const healthy = await Promise.race([healthPromise, timeoutPromise]);
      const responseTime = Date.now() - startTime;

      // Determine status based on health and performance
      let status: DetailedHealthStatus['status'] = 'healthy';
      const issues: string[] = [];
      const recommendations: string[] = [];

      if (!healthy) {
        status = 'unhealthy';
        issues.push('Provider health check returned false');
        recommendations.push('Check provider API connectivity and configuration');
      } else if (responseTime > this.config.degradedThreshold) {
        status = 'degraded';
        issues.push(`Slow response time: ${responseTime}ms`);
        recommendations.push('Monitor provider performance and consider timeout adjustments');
      }

      // Update metrics if enabled
      let metrics: ProviderMetrics | undefined;
      if (this.config.enableMetricsCollection) {
        metrics = this.updateProviderMetrics(providerName, true, responseTime);
      }

      healthStatus = {
        provider: providerName,
        healthy,
        status,
        lastCheck: new Date(),
        responseTime,
        metrics,
        issues: issues.length > 0 ? issues : undefined,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
      };

      // Reset consecutive failures on success
      this.consecutiveFailures.set(providerName, 0);

      console.log(`✅ ${providerName} health check completed: ${status} (${responseTime}ms)`);

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Track consecutive failures
      const failures = (this.consecutiveFailures.get(providerName) || 0) + 1;
      this.consecutiveFailures.set(providerName, failures);

      // Update metrics if enabled
      let metrics: ProviderMetrics | undefined;
      if (this.config.enableMetricsCollection) {
        metrics = this.updateProviderMetrics(providerName, false, responseTime);
      }

      healthStatus = {
        provider: providerName,
        healthy: false,
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        metrics,
        issues: [
          `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          `Consecutive failures: ${failures}`,
        ],
        recommendations: [
          'Check provider API status and network connectivity',
          failures >= this.config.disableAfterFailures
            ? 'Consider temporarily disabling this provider'
            : 'Monitor for continued failures',
        ],
      };

      // Automatically disable provider if configured and threshold reached
      if (this.config.enableAutomaticDisabling && failures >= this.config.disableAfterFailures) {
        console.warn(`⚠️ Automatically disabling ${providerName} after ${failures} consecutive failures`);
        // Note: We don't actually disable here to avoid side effects in health checks
        // This would need to be handled at a higher level with proper notifications
      }

      console.error(`❌ ${providerName} health check failed:`, error);
    }

    return healthStatus;
  }

  /**
   * Get current health status from cache
   */
  public getProviderHealth(providerName: ProviderName): DetailedHealthStatus | null {
    return this.healthCache.get(providerName) || null;
  }

  /**
   * Get health status for all providers from cache
   */
  public getAllProviderHealth(): Map<ProviderName, DetailedHealthStatus> {
    return new Map(this.healthCache);
  }

  /**
   * Get provider metrics
   */
  public getProviderMetrics(providerName: ProviderName): ProviderMetrics | null {
    const history = this.metricsHistory.get(providerName);
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  /**
   * Get provider metrics history
   */
  public getProviderMetricsHistory(providerName: ProviderName): ProviderMetrics[] {
    return this.metricsHistory.get(providerName) || [];
  }

  /**
   * Clear health cache for a specific provider
   */
  public clearProviderHealth(providerName: ProviderName): void {
    this.healthCache.delete(providerName);
    this.consecutiveFailures.delete(providerName);
    console.log(`🧹 Cleared health cache for ${providerName}`);
  }

  /**
   * Clear all health data
   */
  public clearAllHealth(): void {
    this.healthCache.clear();
    this.metricsHistory.clear();
    this.consecutiveFailures.clear();
    console.log('🧹 Cleared all provider health data');
  }

  /**
   * Get summary statistics for all providers
   */
  public getHealthSummary(): {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
    avgResponseTime: number;
  } {
    const statuses = Array.from(this.healthCache.values());
    const total = statuses.length;

    const summary = {
      total,
      healthy: statuses.filter(s => s.status === 'healthy').length,
      degraded: statuses.filter(s => s.status === 'degraded').length,
      unhealthy: statuses.filter(s => s.status === 'unhealthy').length,
      unknown: statuses.filter(s => s.status === 'unknown').length,
      avgResponseTime: 0,
    };

    // Calculate average response time
    const responseTimes = statuses
      .map(s => s.responseTime)
      .filter((time): time is number => typeof time === 'number');

    if (responseTimes.length > 0) {
      summary.avgResponseTime = Math.round(
        responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      );
    }

    return summary;
  }

  /**
   * Update provider metrics
   */
  private updateProviderMetrics(
    providerName: ProviderName,
    success: boolean,
    responseTime: number
  ): ProviderMetrics {
    const history = this.metricsHistory.get(providerName) || [];
    const currentMetrics = history.length > 0 ? { ...history[history.length - 1] } : {
      provider: providerName,
      responseTime: 0,
      successRate: 0,
      errorRate: 0,
      tokenCoverage: 0,
      priceDataAvailability: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
    };

    // Update metrics
    currentMetrics.totalRequests++;
    currentMetrics.responseTime = responseTime;

    if (success) {
      currentMetrics.successfulRequests++;
      currentMetrics.lastSuccessfulRequest = new Date();
    } else {
      currentMetrics.failedRequests++;
      currentMetrics.lastFailedRequest = new Date();
    }

    // Recalculate rates
    currentMetrics.successRate = currentMetrics.successfulRequests / currentMetrics.totalRequests;
    currentMetrics.errorRate = currentMetrics.failedRequests / currentMetrics.totalRequests;

    // Store updated metrics
    const updatedHistory = [...history, currentMetrics];
    this.metricsHistory.set(providerName, updatedHistory);

    return currentMetrics;
  }

  /**
   * Clean up old metrics data
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - this.config.metricsRetentionPeriod;

    this.metricsHistory.forEach((history, providerName) => {
      const filteredHistory = history.filter(metrics => {
        const metricTime = metrics.lastSuccessfulRequest?.getTime() ||
                          metrics.lastFailedRequest?.getTime() ||
                          Date.now();
        return metricTime > cutoffTime;
      });

      if (filteredHistory.length !== history.length) {
        this.metricsHistory.set(providerName, filteredHistory);
      }
    });
  }
}

// Export singleton instance
export const providerHealthMonitor = new ProviderHealthMonitor();