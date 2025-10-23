// RPC provider types and interfaces

export type RpcProvider = 'alchemy' | 'ankr' | 'public' | 'custom';

export interface RpcEndpoint {
  url: string;
  provider: RpcProvider;
  priority: number; // Lower = higher priority (1 = first try)
  timeout?: number;
  maxRetries?: number;
}

export interface ChainRpcConfig {
  chainId: number;
  endpoints: RpcEndpoint[];
}

export interface RpcHealthStatus {
  provider: RpcProvider;
  url: string;
  isHealthy: boolean;
  lastChecked: number;
  latency?: number;
  errorCount: number;
  lastError?: string;
}

export interface RpcFallbackResult<T = any> {
  success: boolean;
  data?: T;
  provider?: RpcProvider;
  url?: string;
  error?: Error;
  attemptedProviders: string[];
}
