/**
 * Advanced chain matching with fuzzy search and suggestions
 * Provides smart chain name resolution with confidence scoring
 */

import { getSupportedChains, type ChainConfig } from '@/lib/chains/registry';

export interface ChainMatch {
  chainId: number;
  chainName: string;
  aliases: string[];
  matchType: 'exact' | 'partial' | 'fuzzy';
  confidence: number;
  isTestnet: boolean;
}

export interface ResolutionResult {
  chainId: number | null;
  suggestions?: string;
  isAmbiguous?: boolean;
  matchType?: 'exact' | 'partial' | 'fuzzy';
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching and typo detection
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Get all possible aliases for a chain ID
 * Synced with aliases in resolveChain() in registry.ts
 */
function getChainAliases(chainId: number): string[] {
  const aliasMap: Record<number, string[]> = {
    // Mainnets
    1: ['ethereum', 'eth', 'mainnet', 'eth-mainnet'],
    8453: ['base', 'base-mainnet', 'basemainnet'],
    137: ['polygon', 'matic', 'poly', 'polygon-mainnet'],
    42161: ['arbitrum', 'arb', 'arbitrum-one', 'arbone', 'arb1'],
    10: ['optimism', 'op', 'op-mainnet', 'opmainnet'],
    43114: ['avalanche', 'avax', 'avalanche-c', 'avax-c'],
    56: ['bsc', 'bnb', 'binance', 'bnb-chain', 'binance-smart-chain'],
    2741: ['abstract', 'abs'],
    1135: ['lisk', 'lsk'],
    
    // Testnets
    11155111: ['sepolia', 'eth-sepolia', 'ethereum-sepolia', 'ethsepolia', 'eth-testnet'],
    84532: ['base-sepolia', 'basesepolia', 'base-testnet'],
    80002: ['amoy', 'polygon-amoy', 'matic-amoy', 'polygon-testnet'],
    421614: ['arb-sepolia', 'arbitrum-sepolia', 'arbitrumsepolia', 'arb-testnet'],
    11155420: ['op-sepolia', 'optimism-sepolia', 'opsepolia', 'op-testnet'],
    43113: ['fuji', 'avalanche-fuji', 'avax-fuji', 'avalanche-testnet', 'avax-testnet'],
    97: ['bsc-testnet', 'bnb-testnet', 'tbnb'],
    11124: ['abstract-sepolia', 'abs-sepolia', 'abstract-testnet'],
    4202: ['lisk-sepolia', 'lsk-sepolia', 'lisk-testnet'],
  };

  return aliasMap[chainId] || [];
}

/**
 * Smart defaults for ambiguous chain names
 * When user types "sepolia" without specifying which one
 */
const AMBIGUOUS_DEFAULTS: Record<string, { 
  chainId: number; 
  alternatives: number[];
  reason: string;
}> = {
  'sepolia': {
    chainId: 11155111, // Default to Ethereum Sepolia
    alternatives: [84532, 421614, 11155420, 4202], // Base, Arb, Op, Lisk
    reason: 'Most commonly used testnet',
  },
  'testnet': {
    chainId: 11155111, // Default to Ethereum Sepolia
    alternatives: [84532, 80002, 421614, 11155420, 43113, 97, 11124, 4202],
    reason: 'Multiple testnets available',
  },
};

/**
 * Find chain matches with confidence scoring
 * Returns multiple matches sorted by confidence
 */
export function findChainMatches(
  input: string,
  options: {
    minConfidence?: number;
    maxResults?: number;
    includeTestnets?: boolean;
  } = {}
): ChainMatch[] {
  const {
    minConfidence = 0.5,
    maxResults = 5,
    includeTestnets = true,
  } = options;

  const normalizedInput = input.toLowerCase().trim();
  const supportedChains = getSupportedChains()
    .filter(chain => chain.supported)
    .filter(chain => includeTestnets || !chain.isTestnet);

  const matches: ChainMatch[] = [];

  for (const chain of supportedChains) {
    const aliases = getChainAliases(chain.id);
    const normalizedChainName = chain.name.toLowerCase();

    // Strategy 1: Exact alias match (highest priority)
    if (aliases.includes(normalizedInput)) {
      matches.push({
        chainId: chain.id,
        chainName: chain.name,
        aliases,
        matchType: 'exact',
        confidence: 1.0,
        isTestnet: chain.isTestnet,
      });
      continue;
    }

    // Strategy 2: Exact chain name match
    if (normalizedChainName === normalizedInput) {
      matches.push({
        chainId: chain.id,
        chainName: chain.name,
        aliases,
        matchType: 'exact',
        confidence: 1.0,
        isTestnet: chain.isTestnet,
      });
      continue;
    }

    // Strategy 3: Partial match in chain name
    if (normalizedChainName.includes(normalizedInput)) {
      const confidence = normalizedInput.length / normalizedChainName.length;
      matches.push({
        chainId: chain.id,
        chainName: chain.name,
        aliases,
        matchType: 'partial',
        confidence: Math.min(confidence * 1.5, 0.95), // Boost partial matches
        isTestnet: chain.isTestnet,
      });
      continue;
    }

    // Strategy 4: Partial match in aliases
    let bestAliasMatch = 0;
    for (const alias of aliases) {
      if (alias.includes(normalizedInput)) {
        const confidence = normalizedInput.length / alias.length;
        bestAliasMatch = Math.max(bestAliasMatch, confidence);
      }
      if (normalizedInput.includes(alias) && alias.length >= 3) {
        const confidence = alias.length / normalizedInput.length;
        bestAliasMatch = Math.max(bestAliasMatch, confidence);
      }
    }
    
    if (bestAliasMatch >= minConfidence) {
      matches.push({
        chainId: chain.id,
        chainName: chain.name,
        aliases,
        matchType: 'partial',
        confidence: Math.min(bestAliasMatch * 1.3, 0.9),
        isTestnet: chain.isTestnet,
      });
      continue;
    }

    // Strategy 5: Fuzzy match with Levenshtein distance
    let bestFuzzyScore = 0;
    for (const alias of aliases) {
      const distance = levenshteinDistance(normalizedInput, alias);
      const maxLen = Math.max(normalizedInput.length, alias.length);
      const similarity = 1 - (distance / maxLen);

      if (similarity > bestFuzzyScore) {
        bestFuzzyScore = similarity;
      }
    }

    if (bestFuzzyScore >= minConfidence) {
      matches.push({
        chainId: chain.id,
        chainName: chain.name,
        aliases,
        matchType: 'fuzzy',
        confidence: bestFuzzyScore * 0.8, // Reduce confidence for fuzzy matches
        isTestnet: chain.isTestnet,
      });
    }
  }

  // Remove duplicates (keep highest confidence)
  const uniqueMatches = new Map<number, ChainMatch>();
  for (const match of matches) {
    const existing = uniqueMatches.get(match.chainId);
    if (!existing || match.confidence > existing.confidence) {
      uniqueMatches.set(match.chainId, match);
    }
  }

  // Sort by confidence (highest first)
  const sortedMatches = Array.from(uniqueMatches.values())
    .sort((a, b) => {
      // Exact matches always first
      if (a.matchType === 'exact' && b.matchType !== 'exact') return -1;
      if (b.matchType === 'exact' && a.matchType !== 'exact') return 1;
      // Then by confidence
      return b.confidence - a.confidence;
    })
    .slice(0, maxResults);

  return sortedMatches;
}

/**
 * Resolve best match or return null
 * For use when you need a single chain ID
 */
export function resolveBestMatch(input: string): ChainMatch | null {
  const matches = findChainMatches(input, { minConfidence: 0.7, maxResults: 1 });
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Format suggestions for CLI output
 * Creates user-friendly "Did you mean" messages
 */
export function formatSuggestions(matches: ChainMatch[], limit: number = 5): string {
  if (matches.length === 0) {
    return 'No matching chains found. Use /chains to see all supported chains.';
  }

  const limitedMatches = matches.slice(0, limit);
  const suggestions = limitedMatches.map(match => {
    const testnetTag = match.isTestnet ? ' 🧪' : '';
    const primaryAlias = match.aliases[0] || match.chainName.toLowerCase().replace(/\s+/g, '-');
    const aliasHint = match.aliases.length > 1 
      ? ` (or ${match.aliases.slice(1, 3).join(', ')})`
      : '';
    
    return `  • ${primaryAlias}${testnetTag} - ${match.chainName} (${match.chainId})${aliasHint}`;
  });

  return `Did you mean:\n${suggestions.join('\n')}`;
}

/**
 * Resolve chain with smart handling of ambiguous names
 * Main function for enhanced chain resolution
 */
export function resolveWithSuggestions(input: string): ResolutionResult {
  const normalizedInput = input.toLowerCase().trim();

  // Check for known ambiguous names with smart defaults
  if (AMBIGUOUS_DEFAULTS[normalizedInput]) {
    const { chainId, alternatives, reason } = AMBIGUOUS_DEFAULTS[normalizedInput];
    
    const alternativeChains = alternatives
      .map(id => {
        const chain = getSupportedChains().find(c => c.id === id);
        if (!chain) return null;
        const aliases = getChainAliases(id);
        return {
          name: chain.name,
          id,
          alias: aliases[0] || chain.name.toLowerCase().replace(/\s+/g, '-'),
        };
      })
      .filter(Boolean) as Array<{ name: string; id: number; alias: string }>;

    const alternativeList = alternativeChains
      .map(c => `${c.alias} (${c.name}, ${c.id})`)
      .join(', ');

    return {
      chainId,
      isAmbiguous: true,
      matchType: 'exact',
      suggestions: `ℹ️ "${input}" is ambiguous (${reason}). Using Ethereum Sepolia (${chainId}).\n💡 Other options: ${alternativeList}`,
    };
  }

  // Try finding matches
  const matches = findChainMatches(normalizedInput, { minConfidence: 0.7 });

  // No matches found - provide suggestions
  if (matches.length === 0) {
    const allMatches = findChainMatches(normalizedInput, { minConfidence: 0.3, maxResults: 5 });
    return {
      chainId: null,
      suggestions: allMatches.length > 0
        ? `❌ Chain "${input}" not found.\n${formatSuggestions(allMatches)}`
        : `❌ Chain "${input}" not found. Use /chains to see all supported chains.`,
    };
  }

  // Single clear match or very high confidence match
  if (matches.length === 1 || matches[0].confidence >= 0.95) {
    const match = matches[0];
    
    // If it's a fuzzy or partial match with lower confidence, show info message
    if (match.matchType !== 'exact' && match.confidence < 0.9) {
      return {
        chainId: match.chainId,
        matchType: match.matchType,
        suggestions: `ℹ️ "${input}" matched to ${match.chainName} (${match.chainId}).`,
      };
    }

    return {
      chainId: match.chainId,
      matchType: match.matchType,
    };
  }

  // Multiple good matches - use best one but show alternatives
  return {
    chainId: matches[0].chainId,
    matchType: matches[0].matchType,
    suggestions: `ℹ️ Multiple matches found. Using ${matches[0].chainName} (${matches[0].chainId}).\n${formatSuggestions(matches.slice(1, 4))}`,
  };
}

/**
 * Get all supported chain names and aliases for documentation
 */
export function getAllChainAliases(): Record<number, { name: string; aliases: string[] }> {
  const result: Record<number, { name: string; aliases: string[] }> = {};
  const chains = getSupportedChains().filter(c => c.supported);

  for (const chain of chains) {
    result[chain.id] = {
      name: chain.name,
      aliases: getChainAliases(chain.id),
    };
  }

  return result;
}
