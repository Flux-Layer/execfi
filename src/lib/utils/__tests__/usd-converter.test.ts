import {
  convertUSDToToken,
  convertTokenToUSD,
  formatTokenAsUSD,
  getExchangeRate,
  convertTokenToToken,
  calculateSlippage,
  applySlippageTolerance,
  isWithinSlippageTolerance,
  batchConvertToUSD,
  convertNativeTokenToUSD,
} from '../usd-converter';
import * as priceService from '@/services/priceService';

jest.mock('@/services/priceService');

describe('USD Converter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('convertUSDToToken', () => {
    it('converts USD amount to token amount', async () => {
      jest.spyOn(priceService, 'getTokenPriceUSD').mockResolvedValue(2000);

      const result = await convertUSDToToken('$100', 'ETH', 1, 18);
      expect(result).toBe('0.050000000000000000'); // $100 / $2000
    });

    it('handles numeric USD input', async () => {
      jest.spyOn(priceService, 'getTokenPriceUSD').mockResolvedValue(2000);

      const result = await convertUSDToToken(100, 'ETH', 1, 18);
      expect(result).toBe('0.050000000000000000');
    });

    it('throws on zero or negative USD amount', async () => {
      jest.spyOn(priceService, 'getTokenPriceUSD').mockResolvedValue(2000);

      await expect(convertUSDToToken(0, 'ETH', 1)).rejects.toThrow();
      await expect(convertUSDToToken(-100, 'ETH', 1)).rejects.toThrow();
    });

    it('throws on invalid token price', async () => {
      jest.spyOn(priceService, 'getTokenPriceUSD').mockResolvedValue(0);

      await expect(convertUSDToToken(100, 'ETH', 1)).rejects.toThrow();
    });

    it('respects token decimals', async () => {
      jest.spyOn(priceService, 'getTokenPriceUSD').mockResolvedValue(1);

      const result = await convertUSDToToken(100, 'USDC', 1, 6);
      expect(result).toBe('100.000000'); // 6 decimals for USDC
    });
  });

  describe('convertTokenToUSD', () => {
    it('converts token amount to USD value', async () => {
      jest.spyOn(priceService, 'getTokenPriceUSD').mockResolvedValue(2000);

      const result = await convertTokenToUSD('0.5', 'ETH', 1);
      expect(result).toBe(1000); // 0.5 ETH * $2000
    });

    it('handles numeric token input', async () => {
      jest.spyOn(priceService, 'getTokenPriceUSD').mockResolvedValue(2000);

      const result = await convertTokenToUSD(0.5, 'ETH', 1);
      expect(result).toBe(1000);
    });

    it('throws on invalid token amount', async () => {
      jest.spyOn(priceService, 'getTokenPriceUSD').mockResolvedValue(2000);

      await expect(convertTokenToUSD('invalid', 'ETH', 1)).rejects.toThrow();
      await expect(convertTokenToUSD(-1, 'ETH', 1)).rejects.toThrow();
    });

    it('handles zero token amount', async () => {
      jest.spyOn(priceService, 'getTokenPriceUSD').mockResolvedValue(2000);

      const result = await convertTokenToUSD(0, 'ETH', 1);
      expect(result).toBe(0);
    });
  });

  describe('formatTokenAsUSD', () => {
    it('formats token amount as USD string', async () => {
      jest.spyOn(priceService, 'getTokenPriceUSD').mockResolvedValue(2000);

      const result = await formatTokenAsUSD('0.5', 'ETH', 1, 'low');
      expect(result).toContain('1,000');
    });

    it('uses auto precision by default', async () => {
      jest.spyOn(priceService, 'getTokenPriceUSD').mockResolvedValue(2000);

      const result = await formatTokenAsUSD('0.5', 'ETH', 1);
      expect(result).toContain('$');
      expect(result).toContain('1,000');
    });
  });

  describe('getExchangeRate', () => {
    it('calculates exchange rate between two tokens', async () => {
      jest.spyOn(priceService, 'getTokenPriceUSD')
        .mockResolvedValueOnce(2000)  // ETH
        .mockResolvedValueOnce(1);    // USDC

      const rate = await getExchangeRate('ETH', 'USDC', 1);
      expect(rate).toBe(2000); // 1 ETH = 2000 USDC
    });

    it('throws on zero destination token price', async () => {
      jest.spyOn(priceService, 'getTokenPriceUSD')
        .mockResolvedValueOnce(2000)
        .mockResolvedValueOnce(0);

      await expect(getExchangeRate('ETH', 'INVALID', 1)).rejects.toThrow();
    });
  });

  describe('convertTokenToToken', () => {
    it('converts between two tokens', async () => {
      jest.spyOn(priceService, 'getTokenPriceUSD')
        .mockResolvedValueOnce(2000)  // ETH
        .mockResolvedValueOnce(1);    // USDC

      const result = await convertTokenToToken('1', 'ETH', 'USDC', 1, 6);
      expect(result).toBe('2000.000000'); // 1 ETH = 2000 USDC
    });

    it('handles numeric amount input', async () => {
      jest.spyOn(priceService, 'getTokenPriceUSD')
        .mockResolvedValueOnce(2000)
        .mockResolvedValueOnce(1);

      const result = await convertTokenToToken(1, 'ETH', 'USDC', 1, 6);
      expect(result).toBe('2000.000000');
    });

    it('throws on invalid source amount', async () => {
      await expect(
        convertTokenToToken('invalid', 'ETH', 'USDC', 1)
      ).rejects.toThrow();
      
      await expect(
        convertTokenToToken(-1, 'ETH', 'USDC', 1)
      ).rejects.toThrow();
    });
  });

  describe('calculateSlippage', () => {
    it('calculates positive slippage (loss)', () => {
      const slippage = calculateSlippage(100, 98);
      expect(slippage).toBe(2); // 2% loss
    });

    it('calculates negative slippage (gain)', () => {
      const slippage = calculateSlippage(100, 102);
      expect(slippage).toBe(-2); // 2% gain
    });

    it('returns 0 for zero input', () => {
      const slippage = calculateSlippage(0, 50);
      expect(slippage).toBe(0);
    });

    it('returns 0 for equal amounts', () => {
      const slippage = calculateSlippage(100, 100);
      expect(slippage).toBe(0);
    });
  });

  describe('applySlippageTolerance', () => {
    it('applies slippage tolerance correctly', () => {
      const result = applySlippageTolerance(100, 1);
      expect(result).toBe(99); // 1% slippage = 99
    });

    it('handles larger slippage percentages', () => {
      const result = applySlippageTolerance(1000, 5);
      expect(result).toBe(950); // 5% slippage = 950
    });

    it('handles zero slippage', () => {
      const result = applySlippageTolerance(100, 0);
      expect(result).toBe(100);
    });
  });

  describe('isWithinSlippageTolerance', () => {
    it('returns true when within tolerance', () => {
      const result = isWithinSlippageTolerance(100, 99.5, 1);
      expect(result).toBe(true); // 99.5 is within 1% of 100
    });

    it('returns false when outside tolerance', () => {
      const result = isWithinSlippageTolerance(100, 98, 1);
      expect(result).toBe(false); // 98 is outside 1% of 100 (min is 99)
    });

    it('returns true at exact tolerance boundary', () => {
      const result = isWithinSlippageTolerance(100, 99, 1);
      expect(result).toBe(true); // Exactly at 1% slippage
    });
  });

  describe('batchConvertToUSD', () => {
    it('converts multiple tokens in parallel', async () => {
      jest.spyOn(priceService, 'getTokenPriceUSD')
        .mockResolvedValueOnce(2000)  // ETH
        .mockResolvedValueOnce(1);    // USDC

      const results = await batchConvertToUSD([
        { tokenAmount: '1', tokenSymbol: 'ETH', chainId: 1 },
        { tokenAmount: '100', tokenSymbol: 'USDC', chainId: 1 },
      ]);

      expect(results).toEqual([2000, 100]);
    });

    it('handles empty array', async () => {
      const results = await batchConvertToUSD([]);
      expect(results).toEqual([]);
    });
  });

  describe('convertNativeTokenToUSD', () => {
    it('converts native token to USD', async () => {
      jest.spyOn(priceService, 'getNativeTokenPrice').mockResolvedValue(2000);

      const result = await convertNativeTokenToUSD('1', 1);
      expect(result).toBe(2000);
    });

    it('handles numeric amount input', async () => {
      jest.spyOn(priceService, 'getNativeTokenPrice').mockResolvedValue(2000);

      const result = await convertNativeTokenToUSD(1, 1);
      expect(result).toBe(2000);
    });

    it('throws on invalid amount', async () => {
      jest.spyOn(priceService, 'getNativeTokenPrice').mockResolvedValue(2000);

      await expect(convertNativeTokenToUSD('invalid', 1)).rejects.toThrow();
      await expect(convertNativeTokenToUSD(-1, 1)).rejects.toThrow();
    });

    it('handles zero amount', async () => {
      jest.spyOn(priceService, 'getNativeTokenPrice').mockResolvedValue(2000);

      const result = await convertNativeTokenToUSD(0, 1);
      expect(result).toBe(0);
    });
  });
});
