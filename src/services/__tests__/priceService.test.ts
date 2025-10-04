import {
  getTokenPriceUSD,
  getNativeTokenPrice,
  getMultipleTokenPrices,
  clearPriceCache,
  getPriceCacheStats,
  warmUpPriceCache,
} from '../priceService';

// Mock fetch globally
global.fetch = jest.fn();

// Mock @lifi/sdk
jest.mock('@lifi/sdk', () => ({
  getTokens: jest.fn(),
}));

import { getTokens } from '@lifi/sdk';

describe('PriceService', () => {
  beforeEach(() => {
    clearPriceCache();
    jest.clearAllMocks();
  });

  describe('getTokenPriceUSD', () => {
    it('fetches price from LiFi successfully', async () => {
      (getTokens as jest.Mock).mockResolvedValue({
        tokens: {
          1: [
            { symbol: 'ETH', priceUSD: '2000' },
            { symbol: 'USDC', priceUSD: '1.0' },
          ],
        },
      });

      const price = await getTokenPriceUSD('ETH', 1);
      expect(price).toBe(2000);
    });

    it('caches price for subsequent calls', async () => {
      (getTokens as jest.Mock).mockResolvedValue({
        tokens: {
          1: [{ symbol: 'ETH', priceUSD: '2000' }],
        },
      });

      await getTokenPriceUSD('ETH', 1);
      await getTokenPriceUSD('ETH', 1);

      // Should only call LiFi once due to caching
      expect(getTokens).toHaveBeenCalledTimes(1);
    });

    it('uses fallback price when LiFi fails', async () => {
      (getTokens as jest.Mock).mockRejectedValue(new Error('API error'));

      const price = await getTokenPriceUSD('ETH', 1);
      expect(price).toBe(2000); // Fallback price
    });

    it('throws error for unknown token', async () => {
      (getTokens as jest.Mock).mockResolvedValue({
        tokens: { 1: [] },
      });

      await expect(getTokenPriceUSD('UNKNOWN', 1)).rejects.toThrow();
    });

    it('handles case-insensitive symbol lookup', async () => {
      (getTokens as jest.Mock).mockResolvedValue({
        tokens: {
          1: [{ symbol: 'eth', priceUSD: '2000' }],
        },
      });

      const price = await getTokenPriceUSD('ETH', 1);
      expect(price).toBe(2000);
    });
  });

  describe('getNativeTokenPrice', () => {
    it('gets ETH price for Ethereum mainnet', async () => {
      (getTokens as jest.Mock).mockResolvedValue({
        tokens: {
          1: [{ symbol: 'ETH', priceUSD: '2000' }],
        },
      });

      const price = await getNativeTokenPrice(1);
      expect(price).toBe(2000);
    });

    it('gets MATIC price for Polygon', async () => {
      (getTokens as jest.Mock).mockResolvedValue({
        tokens: {
          137: [{ symbol: 'MATIC', priceUSD: '0.7' }],
        },
      });

      const price = await getNativeTokenPrice(137);
      expect(price).toBe(0.7);
    });

    it('defaults to ETH for unknown chains', async () => {
      (getTokens as jest.Mock).mockResolvedValue({
        tokens: {
          999: [{ symbol: 'ETH', priceUSD: '2000' }],
        },
      });

      const price = await getNativeTokenPrice(999);
      expect(price).toBe(2000);
    });
  });

  describe('getMultipleTokenPrices', () => {
    it('fetches multiple token prices in parallel', async () => {
      (getTokens as jest.Mock).mockImplementation(async ({ chains }) => {
        const chainId = chains[0];
        return {
          tokens: {
            [chainId]: [
              { symbol: 'ETH', priceUSD: '2000' },
              { symbol: 'USDC', priceUSD: '1.0' },
            ],
          },
        };
      });

      const prices = await getMultipleTokenPrices([
        { symbol: 'ETH', chainId: 1 },
        { symbol: 'USDC', chainId: 1 },
      ]);

      expect(prices.get('ETH-1')).toBe(2000);
      expect(prices.get('USDC-1')).toBe(1.0);
    });

    it('handles partial failures gracefully', async () => {
      let callCount = 0;
      (getTokens as jest.Mock).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            tokens: { 1: [{ symbol: 'ETH', priceUSD: '2000' }] },
          };
        }
        throw new Error('API error');
      });

      const prices = await getMultipleTokenPrices([
        { symbol: 'ETH', chainId: 1 },
        { symbol: 'UNKNOWN', chainId: 1 },
      ]);

      expect(prices.get('ETH-1')).toBe(2000);
      expect(prices.has('UNKNOWN-1')).toBe(false);
    });
  });

  describe('clearPriceCache', () => {
    it('clears all cached prices', async () => {
      (getTokens as jest.Mock).mockResolvedValue({
        tokens: { 1: [{ symbol: 'ETH', priceUSD: '2000' }] },
      });

      await getTokenPriceUSD('ETH', 1);
      let stats = getPriceCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      clearPriceCache();
      stats = getPriceCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('getPriceCacheStats', () => {
    it('returns cache statistics', async () => {
      (getTokens as jest.Mock).mockResolvedValue({
        tokens: { 1: [{ symbol: 'ETH', priceUSD: '2000' }] },
      });

      await getTokenPriceUSD('ETH', 1);
      const stats = getPriceCacheStats();

      expect(stats.size).toBe(1);
      expect(stats.entries).toHaveLength(1);
      expect(stats.entries[0].key).toBe('ETH-1');
      expect(stats.entries[0].price).toBe(2000);
      expect(stats.entries[0].source).toBe('lifi');
    });
  });

  describe('warmUpPriceCache', () => {
    it('pre-fetches common token prices', async () => {
      (getTokens as jest.Mock).mockResolvedValue({
        tokens: {
          1: [
            { symbol: 'ETH', priceUSD: '2000' },
            { symbol: 'USDC', priceUSD: '1.0' },
            { symbol: 'USDT', priceUSD: '1.0' },
            { symbol: 'DAI', priceUSD: '1.0' },
            { symbol: 'WETH', priceUSD: '2000' },
          ],
        },
      });

      await warmUpPriceCache(1);
      const stats = getPriceCacheStats();

      expect(stats.size).toBeGreaterThan(0);
    });

    it('handles errors during warm-up gracefully', async () => {
      (getTokens as jest.Mock).mockRejectedValue(new Error('API error'));

      await expect(warmUpPriceCache(1)).resolves.not.toThrow();
    });
  });

  describe('Cache expiration', () => {
    it('refreshes price after cache expires', async () => {
      jest.useFakeTimers();

      (getTokens as jest.Mock).mockResolvedValue({
        tokens: { 1: [{ symbol: 'ETH', priceUSD: '2000' }] },
      });

      await getTokenPriceUSD('ETH', 1);
      expect(getTokens).toHaveBeenCalledTimes(1);

      // Advance time by 61 seconds (past cache TTL)
      jest.advanceTimersByTime(61 * 1000);

      (getTokens as jest.Mock).mockResolvedValue({
        tokens: { 1: [{ symbol: 'ETH', priceUSD: '2100' }] },
      });

      const newPrice = await getTokenPriceUSD('ETH', 1);
      expect(newPrice).toBe(2100);
      expect(getTokens).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });
  });
});
