/**
 * Price Feed Service
 * Centralized price management with caching and fallbacks
 */

import { getTokens } from '@lifi/sdk';

// Price cache with TTL
interface PriceCacheEntry {
  price: number;
  timestamp: number;
  source: 'lifi' | 'coingecko' | 'static';
}

const priceCache = new Map<string, PriceCacheEntry>();
const CACHE_TTL = 60 * 1000; // 1 minute

// Static fallback prices for major tokens (updated periodically)
const FALLBACK_PRICES: Record<string, number> = {
  'ETH': 2000,
  'WETH': 2000,
  'USDC': 1.0,
  'USDT': 1.0,
  'DAI': 1.0,
  'WBTC': 40000,
  'MATIC': 0.7,
  'AVAX': 25,
  'ARB': 0.8,
  'OP': 1.5,
};

/**
 * Get token price in USD with caching
 * @param symbol - Token symbol (ETH, USDC, etc.)
 * @param chainId - Chain ID
 * @returns Price in USD
 */
export async function getTokenPriceUSD(
  symbol: string,
  chainId: number
): Promise<number> {
  const cacheKey = `${symbol.toUpperCase()}-${chainId}`;

  // Check cache
  const cached = priceCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }

  // Try LiFi first
  try {
    const price = await fetchPriceFromLiFi(symbol, chainId);
    if (price > 0) {
      priceCache.set(cacheKey, {
        price,
        timestamp: Date.now(),
        source: 'lifi',
      });
      return price;
    }
  } catch (error) {
    console.warn(`LiFi price fetch failed for ${symbol}:`, error);
  }

  // Try CoinGecko as fallback (if API key available)
  if (process.env.NEXT_PUBLIC_COINGECKO_API_KEY) {
    try {
      const price = await fetchPriceFromCoinGecko(symbol);
      if (price > 0) {
        priceCache.set(cacheKey, {
          price,
          timestamp: Date.now(),
          source: 'coingecko',
        });
        return price;
      }
    } catch (error) {
      console.warn(`CoinGecko price fetch failed for ${symbol}:`, error);
    }
  }

  // Use static fallback
  const fallbackPrice = FALLBACK_PRICES[symbol.toUpperCase()];
  if (fallbackPrice) {
    console.info(`Using static fallback price for ${symbol}: $${fallbackPrice}`);
    priceCache.set(cacheKey, {
      price: fallbackPrice,
      timestamp: Date.now(),
      source: 'static',
    });
    return fallbackPrice;
  }

  throw new Error(`Unable to fetch price for ${symbol} on chain ${chainId}`);
}

/**
 * Fetch price from LiFi SDK
 * @param symbol - Token symbol
 * @param chainId - Chain ID
 * @returns Price in USD or 0 if not found
 */
async function fetchPriceFromLiFi(
  symbol: string,
  chainId: number
): Promise<number> {
  try {
    const tokens = await getTokens({ chains: [chainId] });
    const chainTokens = tokens.tokens[chainId] || [];

    const token = chainTokens.find(
      t => t.symbol.toUpperCase() === symbol.toUpperCase()
    );

    if (token && token.priceUSD) {
      // Convert SDK priceUSD (string) to number
      return typeof token.priceUSD === 'string' ? parseFloat(token.priceUSD) : token.priceUSD;
    }

    return 0;
  } catch (error) {
    console.warn('LiFi token fetch error:', error);
    return 0;
  }
}

/**
 * Fetch price from CoinGecko API
 * @param symbol - Token symbol
 * @returns Price in USD or 0 if not found
 */
async function fetchPriceFromCoinGecko(symbol: string): Promise<number> {
  const coinIds: Record<string, string> = {
    'ETH': 'ethereum',
    'WETH': 'ethereum',
    'USDC': 'usd-coin',
    'USDT': 'tether',
    'DAI': 'dai',
    'WBTC': 'wrapped-bitcoin',
    'MATIC': 'matic-network',
    'AVAX': 'avalanche-2',
    'ARB': 'arbitrum',
    'OP': 'optimism',
  };

  const coinId = coinIds[symbol.toUpperCase()];
  if (!coinId) return 0;

  const apiKey = process.env.NEXT_PUBLIC_COINGECKO_API_KEY;
  const fetchOptions: RequestInit = apiKey 
    ? { headers: { 'x-cg-demo-api-key': apiKey } }
    : {};

  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
    fetchOptions
  );

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }

  const data = await response.json();
  return data[coinId]?.usd || 0;
}

/**
 * Get native token price for chain
 * @param chainId - Chain ID
 * @returns Price in USD
 */
export async function getNativeTokenPrice(chainId: number): Promise<number> {
  const nativeTokens: Record<number, string> = {
    1: 'ETH',       // Ethereum
    8453: 'ETH',    // Base
    84532: 'ETH',   // Base Sepolia
    11155111: 'ETH', // Sepolia
    137: 'MATIC',   // Polygon
    42161: 'ETH',   // Arbitrum
    10: 'ETH',      // Optimism
    43114: 'AVAX',  // Avalanche
  };

  const symbol = nativeTokens[chainId] || 'ETH';
  return await getTokenPriceUSD(symbol, chainId);
}

/**
 * Batch fetch prices for multiple tokens
 * @param tokens - Array of token symbol and chain ID pairs
 * @returns Map of "symbol-chainId" to price
 */
export async function getMultipleTokenPrices(
  tokens: Array<{ symbol: string; chainId: number }>
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();

  await Promise.all(
    tokens.map(async ({ symbol, chainId }) => {
      try {
        const price = await getTokenPriceUSD(symbol, chainId);
        prices.set(`${symbol}-${chainId}`, price);
      } catch (error) {
        console.warn(`Failed to fetch price for ${symbol}:`, error);
      }
    })
  );

  return prices;
}

/**
 * Clear price cache (useful for testing or manual refresh)
 */
export function clearPriceCache(): void {
  priceCache.clear();
}

/**
 * Get cache statistics
 * @returns Cache statistics object
 */
export function getPriceCacheStats() {
  return {
    size: priceCache.size,
    entries: Array.from(priceCache.entries()).map(([key, value]) => ({
      key,
      price: value.price,
      age: Date.now() - value.timestamp,
      source: value.source,
    })),
  };
}

/**
 * Warm up cache with common tokens
 * @param chainId - Chain ID to warm up cache for
 */
export async function warmUpPriceCache(chainId: number): Promise<void> {
  const commonTokens = ['ETH', 'USDC', 'USDT', 'DAI', 'WETH'];

  await Promise.all(
    commonTokens.map(symbol =>
      getTokenPriceUSD(symbol, chainId).catch(err =>
        console.warn(`Failed to warm cache for ${symbol}:`, err)
      )
    )
  );
}
