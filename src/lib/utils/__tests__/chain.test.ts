import { describe, it, expect } from '@jest/globals';
import { resolveChainIds, getSupportedChainIds, formatChainLabel } from '../chain';

describe('Chain Resolution', () => {
  describe('resolveChainIds', () => {
    describe('Mainnet names', () => {
      it('should resolve ethereum', () => {
        expect(resolveChainIds('ethereum')).toEqual([1]);
      });

      it('should resolve eth', () => {
        expect(resolveChainIds('eth')).toEqual([1]);
      });

      it('should resolve base', () => {
        expect(resolveChainIds('base')).toEqual([8453]);
      });

      it('should resolve polygon', () => {
        expect(resolveChainIds('polygon')).toEqual([137]);
      });

      it('should resolve arbitrum', () => {
        expect(resolveChainIds('arbitrum')).toEqual([42161]);
      });

      it('should resolve optimism', () => {
        expect(resolveChainIds('optimism')).toEqual([10]);
      });
    });

    describe('Testnet names', () => {
      it('should resolve sepolia to Ethereum Sepolia', () => {
        expect(resolveChainIds('sepolia')).toEqual([11155111]);
      });

      it('should resolve eth-sepolia', () => {
        expect(resolveChainIds('eth-sepolia')).toEqual([11155111]);
      });

      it('should resolve base-sepolia', () => {
        expect(resolveChainIds('base-sepolia')).toEqual([84532]);
      });

      it('should resolve amoy', () => {
        expect(resolveChainIds('amoy')).toEqual([80002]);
      });

      it('should resolve fuji', () => {
        expect(resolveChainIds('fuji')).toEqual([43113]);
      });

      it('should resolve arb-sepolia', () => {
        expect(resolveChainIds('arb-sepolia')).toEqual([421614]);
      });

      it('should resolve op-sepolia', () => {
        expect(resolveChainIds('op-sepolia')).toEqual([11155420]);
      });

      it('should resolve bsc-testnet', () => {
        expect(resolveChainIds('bsc-testnet')).toEqual([97]);
      });
    });

    describe('Multiple chains', () => {
      it('should resolve comma-separated names', () => {
        const result = resolveChainIds('ethereum,base,polygon');
        expect(result).toEqual([1, 8453, 137]);
      });

      it('should resolve mixed mainnets and testnets', () => {
        const result = resolveChainIds('ethereum,sepolia,base');
        expect(result).toEqual([1, 11155111, 8453]);
      });

      it('should handle spaces in comma-separated list', () => {
        const result = resolveChainIds('ethereum, base, polygon');
        expect(result).toEqual([1, 8453, 137]);
      });
    });

    describe('Numeric input', () => {
      it('should handle chain ID as string', () => {
        expect(resolveChainIds('11155111')).toEqual([11155111]);
      });

      it('should handle chain ID as number', () => {
        expect(resolveChainIds(11155111)).toEqual([11155111]);
      });

      it('should handle mixed names and IDs', () => {
        const result = resolveChainIds('1,base,11155111');
        expect(result).toEqual([1, 8453, 11155111]);
      });
    });

    describe('Case insensitivity', () => {
      it('should handle uppercase', () => {
        expect(resolveChainIds('ETHEREUM')).toEqual([1]);
      });

      it('should handle mixed case', () => {
        expect(resolveChainIds('Ethereum')).toEqual([1]);
      });

      it('should handle uppercase testnet', () => {
        expect(resolveChainIds('SEPOLIA')).toEqual([11155111]);
      });
    });

    describe('Error handling', () => {
      it('should fallback to default for unknown chain', () => {
        const result = resolveChainIds('unknown-chain-xyz');
        expect(result).toEqual([8453]); // Default Base
      });

      it('should return valid chains even if some are invalid', () => {
        const result = resolveChainIds('ethereum,invalid-chain,base');
        expect(result).toEqual([1, 8453]); // Skips invalid
      });

      it('should fallback when all chains are invalid', () => {
        const result = resolveChainIds('invalid1,invalid2');
        expect(result).toEqual([8453]); // Default Base
      });

      it('should handle empty string', () => {
        const result = resolveChainIds('');
        expect(result).toEqual([8453]); // Default Base
      });

      it('should handle undefined', () => {
        const result = resolveChainIds(undefined);
        expect(result).toEqual([8453]); // Default Base
      });
    });

    describe('Custom default chain', () => {
      it('should use custom default for unknown chain', () => {
        const result = resolveChainIds('unknown', 1); // Default to Ethereum
        expect(result).toEqual([1]);
      });

      it('should use custom default when no input', () => {
        const result = resolveChainIds(undefined, 137); // Default to Polygon
        expect(result).toEqual([137]);
      });
    });
  });

  describe('getSupportedChainIds', () => {
    it('should return array of chain IDs', () => {
      const chainIds = getSupportedChainIds();
      expect(Array.isArray(chainIds)).toBe(true);
      expect(chainIds.length).toBeGreaterThan(0);
    });

    it('should include mainnet chains', () => {
      const chainIds = getSupportedChainIds();
      expect(chainIds).toContain(1);    // Ethereum
      expect(chainIds).toContain(8453); // Base
      expect(chainIds).toContain(137);  // Polygon
    });

    it('should include testnet chains', () => {
      const chainIds = getSupportedChainIds();
      expect(chainIds).toContain(11155111); // Sepolia
      expect(chainIds).toContain(84532);    // Base Sepolia
      expect(chainIds).toContain(80002);    // Amoy
    });
  });

  describe('formatChainLabel', () => {
    it('should format mainnet chain labels', () => {
      expect(formatChainLabel(1)).toBe('Ethereum');
      expect(formatChainLabel(8453)).toBe('Base');
    });

    it('should format testnet chain labels', () => {
      expect(formatChainLabel(11155111)).toBe('Ethereum Sepolia');
      expect(formatChainLabel(84532)).toBe('Base Sepolia');
    });

    it('should handle unknown chain ID gracefully', () => {
      expect(formatChainLabel(999999)).toBe('Chain 999999');
    });
  });
});
