import { describe, it, expect } from '@jest/globals';
import {
  findChainMatches,
  resolveBestMatch,
  resolveWithSuggestions,
  formatSuggestions,
} from '../chainMatcher';

describe('Chain Matcher', () => {
  describe('findChainMatches', () => {
    it('should find exact matches', () => {
      const matches = findChainMatches('ethereum');
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].chainId).toBe(1);
      expect(matches[0].matchType).toBe('exact');
      expect(matches[0].confidence).toBe(1.0);
    });

    it('should find testnet exact matches', () => {
      const matches = findChainMatches('sepolia');
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].chainId).toBe(11155111);
      expect(matches[0].matchType).toBe('exact');
    });

    it('should find partial matches', () => {
      const matches = findChainMatches('arb');
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some(m => m.chainId === 42161)).toBe(true); // Arbitrum
    });

    it('should handle fuzzy matches (typos)', () => {
      const matches = findChainMatches('etherem'); // typo: ethereum
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].matchType).toBe('fuzzy');
    });

    it('should return multiple matches for ambiguous input', () => {
      const matches = findChainMatches('sep');
      expect(matches.length).toBeGreaterThan(1);
      // Should include various Sepolia chains
    });

    it('should respect minConfidence threshold', () => {
      const matches = findChainMatches('xyz', { minConfidence: 0.8 });
      expect(matches.length).toBe(0);
    });

    it('should respect maxResults limit', () => {
      const matches = findChainMatches('eth', { maxResults: 2 });
      expect(matches.length).toBeLessThanOrEqual(2);
    });

    it('should filter testnets when requested', () => {
      const matches = findChainMatches('sepolia', { includeTestnets: false });
      expect(matches.length).toBe(0);
    });
  });

  describe('resolveBestMatch', () => {
    it('should return best match for clear input', () => {
      const match = resolveBestMatch('ethereum');
      expect(match).not.toBeNull();
      expect(match?.chainId).toBe(1);
    });

    it('should return null for no matches', () => {
      const match = resolveBestMatch('xyz123invalid');
      expect(match).toBeNull();
    });

    it('should handle typos reasonably', () => {
      const match = resolveBestMatch('polygn'); // typo: polygon
      expect(match?.chainId).toBe(137);
    });
  });

  describe('resolveWithSuggestions', () => {
    it('should resolve exact matches without suggestions', () => {
      const result = resolveWithSuggestions('ethereum');
      expect(result.chainId).toBe(1);
      expect(result.suggestions).toBeUndefined();
    });

    it('should resolve ambiguous "sepolia" with warning', () => {
      const result = resolveWithSuggestions('sepolia');
      expect(result.chainId).toBe(11155111);
      expect(result.isAmbiguous).toBe(true);
      expect(result.suggestions).toContain('ambiguous');
    });

    it('should provide suggestions for unknown chains', () => {
      const result = resolveWithSuggestions('unknownchain123');
      expect(result.chainId).toBeNull();
      expect(result.suggestions).toContain('not found');
    });

    it('should show info for partial matches', () => {
      const result = resolveWithSuggestions('arb-sep');
      expect(result.chainId).toBe(421614); // Arbitrum Sepolia
      // May or may not have suggestions depending on confidence
    });

    it('should handle case insensitivity', () => {
      const result = resolveWithSuggestions('ETHEREUM');
      expect(result.chainId).toBe(1);
    });
  });

  describe('formatSuggestions', () => {
    it('should format suggestions with testnet indicators', () => {
      const matches = findChainMatches('sepolia');
      const formatted = formatSuggestions(matches);
      expect(formatted).toContain('🧪');
      expect(formatted).toContain('Did you mean');
    });

    it('should respect limit parameter', () => {
      const matches = findChainMatches('eth');
      const formatted = formatSuggestions(matches, 2);
      const lines = formatted.split('\n');
      expect(lines.length).toBeLessThanOrEqual(3); // Header + 2 suggestions
    });

    it('should handle empty matches array', () => {
      const formatted = formatSuggestions([]);
      expect(formatted).toContain('No matching chains found');
    });
  });
});
