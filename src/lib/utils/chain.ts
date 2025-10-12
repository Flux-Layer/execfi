// Chain utility functions for portfolio service
import { 
  getSupportedChains, 
  getChainDisplayName,
  resolveChain,
  type ChainConfig
} from "@/lib/chains/registry";

/**
 * Resolve chain IDs from various input formats
 * Uses registry's resolveChain() for consistent resolution across all commands
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
    const errors: string[] = [];

    for (const part of parts) {
      // Try parsing as number first
      const parsed = parseInt(part);
      if (!isNaN(parsed)) {
        chainIds.push(parsed);
        continue;
      }

      // Try resolving via registry (single source of truth)
      try {
        const chainConfig = resolveChain(part);
        chainIds.push(chainConfig.id);
      } catch (error) {
        // Chain not found - collect error but continue processing other chains
        errors.push(part);
        console.warn(`⚠️ Chain "${part}" not recognized`);
      }
    }

    // If we resolved at least one valid chain, return those
    if (chainIds.length > 0) {
      return chainIds;
    }

    // If all chains failed to resolve, log comprehensive warning and use default
    if (errors.length > 0) {
      console.warn(
        `❌ Failed to resolve chains: ${errors.join(', ')}. ` +
        `Using default chain ${defaultChainId}. ` +
        `Use chain IDs directly or check supported chain names.`
      );
    }
    
    return [defaultChainId];
  }

  return [defaultChainId];
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
 * Get all supported chain IDs (mainnet + testnet)
 */
export function getSupportedChainIds(): number[] {
  return getSupportedChains()
    .filter(chain => chain.supported)
    .map(chain => chain.id);
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