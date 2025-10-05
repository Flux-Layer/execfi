// lib/utils/tokenDecimals.ts - On-chain token decimals fetching with caching

import { type PublicClient, erc20Abi, getContract } from "viem";

interface DecimalsCacheEntry {
  decimals: number;
  timestamp: number;
  chainId: number;
}

// In-memory cache for token decimals
// Key format: "chainId-tokenAddress"
const decimalsCache = new Map<string, DecimalsCacheEntry>();

// Cache TTL: 1 hour (decimals never change for deployed contracts)
const DECIMALS_CACHE_TTL = 3600000; // 1 hour in milliseconds

/**
 * Get token decimals from on-chain contract with caching
 * CRITICAL: Always fetches from chain as source of truth
 */
export async function getTokenDecimals(
  tokenAddress: `0x${string}`,
  chainId: number,
  publicClient: PublicClient
): Promise<number> {
  const cacheKey = `${chainId}-${tokenAddress.toLowerCase()}`;
  const now = Date.now();

  // Check cache first
  const cached = decimalsCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < DECIMALS_CACHE_TTL) {
    console.log(`💾 [Decimals] Using cached decimals for ${tokenAddress} on chain ${chainId}: ${cached.decimals}`);
    return cached.decimals;
  }

  try {
    console.log(`🔍 [Decimals] Fetching on-chain decimals for ${tokenAddress} on chain ${chainId}`);

    // Create contract instance
    const tokenContract = getContract({
      address: tokenAddress,
      abi: erc20Abi,
      client: publicClient,
    });

    // Fetch decimals from contract
    const decimals = await tokenContract.read.decimals();

    // Validate decimals is reasonable (0-77 is standard, uint8 max is 255 but practical max is ~77)
    if (decimals < 0 || decimals > 77) {
      throw new Error(`Invalid decimals value: ${decimals}. Expected 0-77.`);
    }

    console.log(`✅ [Decimals] Fetched decimals for ${tokenAddress}: ${decimals}`);

    // Cache the result
    decimalsCache.set(cacheKey, {
      decimals,
      timestamp: now,
      chainId,
    });

    return decimals;
  } catch (error: any) {
    console.error(`❌ [Decimals] Failed to fetch decimals for ${tokenAddress} on chain ${chainId}:`, error.message);
    
    // If we have stale cache, use it as fallback
    if (cached) {
      console.warn(`⚠️ [Decimals] Using stale cached decimals as fallback: ${cached.decimals}`);
      return cached.decimals;
    }

    throw new Error(
      `Failed to fetch token decimals for ${tokenAddress} on chain ${chainId}: ${error.message}. Token may not be a valid ERC-20.`
    );
  }
}

/**
 * Verify token decimals match expected value
 * Returns actual on-chain decimals if different
 */
export async function verifyTokenDecimals(
  tokenAddress: `0x${string}`,
  expectedDecimals: number,
  chainId: number,
  publicClient: PublicClient
): Promise<{ verified: boolean; actualDecimals: number; mismatch: boolean }> {
  const actualDecimals = await getTokenDecimals(tokenAddress, chainId, publicClient);

  const mismatch = actualDecimals !== expectedDecimals;

  if (mismatch) {
    console.warn(
      `⚠️ [Decimals] MISMATCH for ${tokenAddress} on chain ${chainId}:`,
      `Expected: ${expectedDecimals}, Actual: ${actualDecimals}`
    );
  }

  return {
    verified: !mismatch,
    actualDecimals,
    mismatch,
  };
}

/**
 * Batch fetch decimals for multiple tokens
 * Useful for swap/bridge operations with multiple tokens
 */
export async function batchGetTokenDecimals(
  tokens: Array<{ address: `0x${string}`; chainId: number }>,
  publicClients: Map<number, PublicClient>
): Promise<Map<string, number>> {
  const results = new Map<string, number>();

  await Promise.all(
    tokens.map(async ({ address, chainId }) => {
      const publicClient = publicClients.get(chainId);
      if (!publicClient) {
        console.warn(`⚠️ [Decimals] No public client for chain ${chainId}, skipping ${address}`);
        return;
      }

      try {
        const decimals = await getTokenDecimals(address, chainId, publicClient);
        results.set(`${chainId}-${address.toLowerCase()}`, decimals);
      } catch (error) {
        console.error(`❌ [Decimals] Failed to fetch decimals for ${address} on chain ${chainId}`);
      }
    })
  );

  return results;
}

/**
 * Clear decimals cache for a specific token or entire chain
 */
export function clearDecimalsCache(tokenAddress?: string, chainId?: number) {
  if (tokenAddress && chainId) {
    const key = `${chainId}-${tokenAddress.toLowerCase()}`;
    decimalsCache.delete(key);
    console.log(`🗑️ [Decimals] Cleared cache for ${tokenAddress} on chain ${chainId}`);
  } else if (chainId) {
    // Clear all entries for this chain
    for (const key of decimalsCache.keys()) {
      if (key.startsWith(`${chainId}-`)) {
        decimalsCache.delete(key);
      }
    }
    console.log(`🗑️ [Decimals] Cleared all cache for chain ${chainId}`);
  } else {
    // Clear entire cache
    decimalsCache.clear();
    console.log(`🗑️ [Decimals] Cleared entire decimals cache`);
  }
}

/**
 * Get cache statistics (useful for debugging)
 */
export function getDecimalsCacheStats() {
  return {
    size: decimalsCache.size,
    entries: Array.from(decimalsCache.entries()).map(([key, value]) => ({
      key,
      decimals: value.decimals,
      age: Date.now() - value.timestamp,
      chainId: value.chainId,
    })),
  };
}
