// Chain utility functions for portfolio service
import { getSupportedChains, getChainDisplayName } from "@/lib/chains/registry";

/**
 * Resolve chain IDs from various input formats
 */
export function resolveChainIds(input?: string | number, defaultChainId: number = 8453): number[] {
  if (!input) {
    return [defaultChainId];
  }

  if (typeof input === 'number') {
    return [input];
  }

  if (typeof input === 'string') {
    // Handle comma-separated list
    const parts = input.split(',').map(part => part.trim());
    const chainIds: number[] = [];

    for (const part of parts) {
      // Try parsing as number first
      const parsed = parseInt(part);
      if (!isNaN(parsed)) {
        chainIds.push(parsed);
        continue;
      }

      // Try resolving as chain name/slug
      const resolvedId = resolveChainNameToId(part.toLowerCase());
      if (resolvedId) {
        chainIds.push(resolvedId);
      }
    }

    return chainIds.length > 0 ? chainIds : [defaultChainId];
  }

  return [defaultChainId];
}

/**
 * Resolve chain name/slug to chain ID
 */
function resolveChainNameToId(nameOrSlug: string): number | null {
  const supportedChains = getSupportedChains();

  // Direct name matches
  const nameMatches: Record<string, number> = {
    'base': 8453,
    'ethereum': 1,
    'eth': 1,
    'mainnet': 1,
    'polygon': 137,
    'matic': 137,
    'arbitrum': 42161,
    'arb': 42161,
    'optimism': 10,
    'op': 10,
    'avalanche': 43114,
    'avax': 43114,
    'bsc': 56,
    'binance': 56,
    'abstract': 2741,
    'lisk': 1135,
  };

  // Check direct matches first
  if (nameMatches[nameOrSlug]) {
    return nameMatches[nameOrSlug];
  }

  // Check registry by name (case-insensitive)
  for (const chain of supportedChains) {
    if (chain.name.toLowerCase() === nameOrSlug ||
        chain.symbol.toLowerCase() === nameOrSlug) {
      return chain.id;
    }
  }

  return null;
}

/**
 * Format chain label for display
 */
export function formatChainLabel(chainId: number): string {
  try {
    return getChainDisplayName(chainId);
  } catch {
    return `Chain ${chainId}`;
  }
}

/**
 * Check if chain ID is supported
 */
export function isChainSupported(chainId: number): boolean {
  const supportedChains = getSupportedChains();
  return supportedChains.some(chain => chain.id === chainId && chain.supported);
}

/**
 * Get all supported mainnet chain IDs
 */
export function getSupportedMainnetChainIds(): number[] {
  return getSupportedChains()
    .filter(chain => chain.supported && !chain.isTestnet)
    .map(chain => chain.id);
}

/**
 * Get all supported testnet chain IDs
 */
export function getSupportedTestnetChainIds(): number[] {
  return getSupportedChains()
    .filter(chain => chain.supported && chain.isTestnet)
    .map(chain => chain.id);
}