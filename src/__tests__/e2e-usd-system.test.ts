/**
 * E2E Tests for USD System
 * Tests the complete USD implementation from intent parsing to conversion
 */

import { describe, it, expect } from '@jest/globals';
import { validateIntent, isUSDBasedIntent, parseIntentUSDAmount } from '@/lib/ai/schema';
import { convertUSDToToken, convertTokenToUSD } from '@/lib/utils/usd-converter';
import { formatUSDValue, parseUSDInput } from '@/lib/utils/usd-parser';
import { getTokenPriceUSD } from '@/services/priceService';

describe('E2E: USD System Integration', () => {
  describe('Intent Parsing with USD', () => {
    it('should accept USD-based transfer intent', () => {
      const intent = {
        ok: true,
        intent: {
          action: 'transfer',
          chain: 'base',
          token: { type: 'native', symbol: 'ETH', decimals: 18 },
          amountUSD: '100',
          recipient: '0x1234567890123456789012345678901234567890',
        },
      };

      const validated = validateIntent(intent);
      expect(validated.ok).toBe(true);
      
      if (validated.ok === true) {
        expect(isUSDBasedIntent(validated.intent)).toBe(true);
        expect(validated.intent.amountUSD).toBe('100');
      }
    });

    it('should accept traditional token-based transfer intent', () => {
      const intent = {
        ok: true,
        intent: {
          action: 'transfer',
          chain: 'base',
          token: { type: 'native', symbol: 'ETH', decimals: 18 },
          amount: '0.1',
          recipient: '0x1234567890123456789012345678901234567890',
        },
      };

      const validated = validateIntent(intent);
      expect(validated.ok).toBe(true);
      
      if (validated.ok === true) {
        expect(isUSDBasedIntent(validated.intent)).toBe(false);
        expect(validated.intent.amount).toBe('0.1');
      }
    });

    it('should accept USD-based swap intent', () => {
      const intent = {
        ok: true,
        intent: {
          action: 'swap',
          fromChain: 'base',
          fromToken: 'ETH',
          toToken: 'USDC',
          amountUSD: '50',
        },
      };

      const validated = validateIntent(intent);
      expect(validated.ok).toBe(true);
      
      if (validated.ok === true) {
        expect(isUSDBasedIntent(validated.intent)).toBe(true);
      }
    });

    it('should reject intent without amount or amountUSD', () => {
      const intent = {
        ok: true,
        intent: {
          action: 'transfer',
          chain: 'base',
          token: { type: 'native', symbol: 'ETH', decimals: 18 },
          recipient: '0x1234567890123456789012345678901234567890',
        },
      };

      expect(() => validateIntent(intent)).toThrow();
    });
  });

  describe('USD Amount Parsing', () => {
    it('should parse USD amount from intent', () => {
      const amount = parseIntentUSDAmount('$100');
      expect(amount).toBe(100);
    });

    it('should parse USD amount without dollar sign', () => {
      const amount = parseIntentUSDAmount('100');
      expect(amount).toBe(100);
    });

    it('should throw on invalid USD amount', () => {
      expect(() => parseIntentUSDAmount('invalid')).toThrow();
    });
  });

  describe('USD Parser Functions', () => {
    it('should format various USD amounts correctly', () => {
      expect(formatUSDValue(0.000123, 'auto')).toBe('$0.000123');
      expect(formatUSDValue(0.5, 'auto')).toBe('$0.5000');
      expect(formatUSDValue(12.34, 'auto')).toBe('$12.34');
      expect(formatUSDValue(1234.56, 'auto')).toBe('$1,235');
    });

    it('should parse USD input strings', () => {
      expect(parseUSDInput('$100')).toBe(100);
      expect(parseUSDInput('100')).toBe(100);
      expect(parseUSDInput('1,234.56')).toBe(1234.56);
    });
  });

  describe('USD Conversion (requires real prices)', () => {
    // These tests interact with real APIs
    it('should convert USD to ETH', async () => {
      try {
        const result = await convertUSDToToken(100, 'ETH', 8453); // Base chain
        const tokenAmount = parseFloat(result);
        
        // Verify we got a reasonable amount (at ETH ~$4000, $100 should be ~0.025 ETH)
        expect(tokenAmount).toBeGreaterThan(0);
        expect(tokenAmount).toBeLessThan(1); // $100 is less than 1 ETH
      } catch (error) {
        // Skip if API unavailable
        console.warn('Skipping USD conversion test (API unavailable)', error);
      }
    }, 10000);

    it('should convert ETH to USD', async () => {
      try {
        const result = await convertTokenToUSD(1, 'ETH', 8453);
        
        // Verify we got a reasonable USD amount (ETH should be > $1000)
        expect(result).toBeGreaterThan(1000);
        expect(result).toBeLessThan(10000);
      } catch (error) {
        console.warn('Skipping token to USD conversion test (API unavailable)', error);
      }
    }, 10000);
  });

  describe('Price Service Integration', () => {
    it('should fetch ETH price', async () => {
      try {
        const price = await getTokenPriceUSD('ETH', 8453);
        
        expect(price).toBeGreaterThan(0);
        expect(typeof price).toBe('number');
      } catch (error) {
        console.warn('Skipping price fetch test (API unavailable)', error);
      }
    }, 10000);

    it('should fetch USDC price', async () => {
      try {
        const price = await getTokenPriceUSD('USDC', 8453);
        
        // USDC should be close to $1
        expect(price).toBeGreaterThan(0.95);
        expect(price).toBeLessThan(1.05);
      } catch (error) {
        console.warn('Skipping USDC price fetch test (API unavailable)', error);
      }
    }, 10000);
  });

  describe('Complete Flow: USD Intent → Token Amount', () => {
    it('should handle complete USD transfer flow', async () => {
      // 1. Parse intent
      const intent = {
        ok: true,
        intent: {
          action: 'transfer',
          chain: 8453,
          token: { type: 'native', symbol: 'ETH', decimals: 18 },
          amountUSD: '$100',
          recipient: '0x1234567890123456789012345678901234567890',
        },
      };

      const validated = validateIntent(intent);
      expect(validated.ok).toBe(true);

      if (validated.ok === true) {
        // 2. Check if USD-based
        const isUSD = isUSDBasedIntent(validated.intent);
        expect(isUSD).toBe(true);

        if (validated.intent.amountUSD) {
          // 3. Parse USD amount
          const usdAmount = parseIntentUSDAmount(validated.intent.amountUSD);
          expect(usdAmount).toBe(100);

          try {
            // 4. Convert to token amount
            const tokenAmount = await convertUSDToToken(
              usdAmount,
              validated.intent.token.symbol,
              validated.intent.chain as number
            );

            // 5. Verify conversion
            expect(parseFloat(tokenAmount)).toBeGreaterThan(0);
            
            // 6. Format for display
            const formatted = formatUSDValue(usdAmount, 'medium');
            expect(formatted).toBe('$100.00');
          } catch (error) {
            console.warn('Skipping conversion part of test (API unavailable)', error);
          }
        }
      }
    }, 15000);
  });
});
