// lib/token-merger.ts - Intelligent token merging and deduplication

import type { UnifiedToken, TokenGroup, SimilarTokenGroup } from '@/types/unified-token';
import type { ProviderName } from '@/types/provider-types';

/**
 * Merge configuration for different merge strategies
 */
export interface MergeConfig {
  // Deduplication settings
  enableExactMatch: boolean; // address + chainId exact match
  enableFuzzyMatch: boolean; // similar symbols different addresses
  fuzzyMatchThreshold: number; // 0-1 similarity threshold

  // Conflict resolution priorities
  providerPriorities: Record<ProviderName, number>;
  preferVerified: boolean; // Prefer verified tokens in conflicts
  preferPriceData: boolean; // Prefer tokens with price data

  // Data enhancement settings
  enableMetadataMerging: boolean; // Merge provider-specific metadata
  enableSourceMerging: boolean; // Combine sources from all providers
  recalculateConfidence: boolean; // Recalculate confidence after merge
}

/**
 * Default merge configuration
 */
const DEFAULT_MERGE_CONFIG: MergeConfig = {
  enableExactMatch: true,
  enableFuzzyMatch: false, // Disabled by default for safety
  fuzzyMatchThreshold: 0.85,
  providerPriorities: {
    lifi: 100,
    relay: 80,
    local: 60,
    coingecko: 70,
  },
  preferVerified: true,
  preferPriceData: true,
  enableMetadataMerging: true,
  enableSourceMerging: true,
  recalculateConfidence: true,
};

/**
 * Result of the merge operation
 */
export interface MergeResult {
  mergedTokens: UnifiedToken[];
  statistics: {
    originalCount: number;
    finalCount: number;
    deduplicatedCount: number;
    enhancedCount: number;
    conflictsResolved: number;
  };
  conflicts: Array<{
    identifier: string;
    conflictType: 'exact_duplicate' | 'similar_symbol' | 'metadata_conflict';
    tokens: UnifiedToken[];
    resolution: 'merged' | 'kept_best' | 'kept_all';
  }>;
}

/**
 * Token Merger - handles intelligent deduplication and enhancement
 */
export class TokenMerger {
  private config: MergeConfig;

  constructor(config?: Partial<MergeConfig>) {
    this.config = { ...DEFAULT_MERGE_CONFIG, ...config };
  }

  /**
   * Main merge function - intelligently merges tokens from multiple providers
   */
  public mergeTokens(tokens: UnifiedToken[]): MergeResult {
    console.log(`🔄 Starting token merge for ${tokens.length} tokens`);

    const statistics = {
      originalCount: tokens.length,
      finalCount: 0,
      deduplicatedCount: 0,
      enhancedCount: 0,
      conflictsResolved: 0,
    };

    const conflicts: MergeResult['conflicts'] = [];
    let mergedTokens = [...tokens];

    // Step 1: Exact match deduplication (address + chainId)
    if (this.config.enableExactMatch) {
      const exactMatchResult = this.performExactMatch(mergedTokens);
      mergedTokens = exactMatchResult.tokens;
      statistics.deduplicatedCount += exactMatchResult.deduplicatedCount;
      statistics.conflictsResolved += exactMatchResult.conflictsResolved;
      conflicts.push(...exactMatchResult.conflicts);
    }

    // Step 2: Fuzzy matching (similar symbols, different addresses)
    if (this.config.enableFuzzyMatch) {
      const fuzzyMatchResult = this.performFuzzyMatch(mergedTokens);
      mergedTokens = fuzzyMatchResult.tokens;
      statistics.conflictsResolved += fuzzyMatchResult.conflictsResolved;
      conflicts.push(...fuzzyMatchResult.conflicts);
    }

    // Step 3: Enhance tokens with merged metadata
    if (this.config.enableMetadataMerging) {
      const enhancedTokens = this.enhanceTokens(mergedTokens);
      mergedTokens = enhancedTokens;
      statistics.enhancedCount = mergedTokens.filter(t => t.sources.length > 1).length;
    }

    // Step 4: Sort by confidence and provider priority
    mergedTokens = this.sortTokens(mergedTokens);

    statistics.finalCount = mergedTokens.length;

    console.log(`✅ Token merge completed:`, {
      original: statistics.originalCount,
      final: statistics.finalCount,
      deduplicated: statistics.deduplicatedCount,
      conflicts: statistics.conflictsResolved,
    });

    return {
      mergedTokens,
      statistics,
      conflicts,
    };
  }

  /**
   * Perform exact match deduplication based on address + chainId
   */
  private performExactMatch(tokens: UnifiedToken[]): {
    tokens: UnifiedToken[];
    deduplicatedCount: number;
    conflictsResolved: number;
    conflicts: MergeResult['conflicts'];
  } {
    const tokenGroups = new Map<string, TokenGroup>();
    const conflicts: MergeResult['conflicts'] = [];

    // Group tokens by address + chainId
    tokens.forEach(token => {
      const identifier = `${token.address.toLowerCase()}_${token.chainId}`;

      if (!tokenGroups.has(identifier)) {
        tokenGroups.set(identifier, {
          identifier,
          tokens: [],
        });
      }

      tokenGroups.get(identifier)!.tokens.push(token);
    });

    // Merge tokens in each group
    const mergedTokens: UnifiedToken[] = [];
    let deduplicatedCount = 0;
    let conflictsResolved = 0;

    tokenGroups.forEach(group => {
      if (group.tokens.length === 1) {
        // No duplicates
        mergedTokens.push(group.tokens[0]);
      } else {
        // Multiple tokens for same address+chain - merge them
        const merged = this.mergeTokenGroup(group.tokens);
        mergedTokens.push(merged);

        deduplicatedCount += group.tokens.length - 1;
        conflictsResolved++;

        conflicts.push({
          identifier: group.identifier,
          conflictType: 'exact_duplicate',
          tokens: group.tokens,
          resolution: 'merged',
        });
      }
    });

    return {
      tokens: mergedTokens,
      deduplicatedCount,
      conflictsResolved,
      conflicts,
    };
  }

  /**
   * Perform fuzzy matching for similar symbols with different addresses
   */
  private performFuzzyMatch(tokens: UnifiedToken[]): {
    tokens: UnifiedToken[];
    conflictsResolved: number;
    conflicts: MergeResult['conflicts'];
  } {
    const symbolGroups = new Map<string, UnifiedToken[]>();
    const conflicts: MergeResult['conflicts'] = [];

    // Group by normalized symbol
    tokens.forEach(token => {
      const normalizedSymbol = token.symbol.toLowerCase();
      if (!symbolGroups.has(normalizedSymbol)) {
        symbolGroups.set(normalizedSymbol, []);
      }
      symbolGroups.get(normalizedSymbol)!.push(token);
    });

    // Find similar groups and resolve conflicts
    const finalTokens: UnifiedToken[] = [];
    let conflictsResolved = 0;

    symbolGroups.forEach(group => {
      if (group.length === 1) {
        finalTokens.push(group[0]);
      } else {
        // Multiple tokens with same symbol - analyze similarity
        const similarity = this.calculateGroupSimilarity(group);

        if (similarity >= this.config.fuzzyMatchThreshold) {
          // High similarity - keep the best one
          const bestToken = this.selectBestToken(group);
          finalTokens.push(bestToken);
          conflictsResolved++;

          conflicts.push({
            identifier: `symbol_${group[0].symbol.toLowerCase()}`,
            conflictType: 'similar_symbol',
            tokens: group,
            resolution: 'kept_best',
          });
        } else {
          // Low similarity - keep all
          finalTokens.push(...group);

          conflicts.push({
            identifier: `symbol_${group[0].symbol.toLowerCase()}`,
            conflictType: 'similar_symbol',
            tokens: group,
            resolution: 'kept_all',
          });
        }
      }
    });

    return {
      tokens: finalTokens,
      conflictsResolved,
      conflicts,
    };
  }

  /**
   * Merge a group of tokens with the same address + chainId
   */
  private mergeTokenGroup(tokens: UnifiedToken[]): UnifiedToken {
    if (tokens.length === 1) {
      return tokens[0];
    }

    // Select base token (highest priority provider)
    const baseToken = this.selectBestToken(tokens);

    // Merge sources from all tokens
    const allSources = [...new Set(tokens.flatMap(t => t.sources))];

    // Merge metadata from all providers
    const mergedMetadata: UnifiedToken['metadata'] = {};
    tokens.forEach(token => {
      Object.entries(token.metadata).forEach(([provider, meta]) => {
        if (meta) {
          (mergedMetadata as any)[provider] = meta;
        }
      });
    });

    // Use the best available data for each field
    const enhancedToken: UnifiedToken = {
      ...baseToken,
      sources: allSources,
      metadata: mergedMetadata,

      // Enhanced data selection
      logoURI: this.selectBestValue(tokens.map(t => t.logoURI).filter(Boolean)) || baseToken.logoURI,
      priceUSD: this.selectBestValue(tokens.map(t => t.priceUSD).filter(Boolean)) || baseToken.priceUSD,
      verified: tokens.some(t => t.verified), // True if any provider verifies it
      lastUpdated: new Date().toISOString(),
    };

    // Recalculate confidence if enabled
    if (this.config.recalculateConfidence) {
      enhancedToken.confidence = this.calculateMergedConfidence(tokens);
    }

    return enhancedToken;
  }

  /**
   * Select the best token from a group based on provider priority and data quality
   */
  private selectBestToken(tokens: UnifiedToken[]): UnifiedToken {
    return tokens.sort((a, b) => {
      // 1. Provider priority
      const aPriority = Math.max(...a.sources.map(s => this.config.providerPriorities[s] || 0));
      const bPriority = Math.max(...b.sources.map(s => this.config.providerPriorities[s] || 0));

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      // 2. Verification status
      if (this.config.preferVerified && a.verified !== b.verified) {
        return b.verified ? 1 : -1;
      }

      // 3. Price data availability
      if (this.config.preferPriceData && !!a.priceUSD !== !!b.priceUSD) {
        return b.priceUSD ? 1 : -1;
      }

      // 4. Confidence score
      return b.confidence - a.confidence;
    })[0];
  }

  /**
   * Select the best value from multiple options (prefer non-null, longer strings)
   */
  private selectBestValue<T>(values: T[]): T | undefined {
    if (values.length === 0) return undefined;

    // Prefer non-null values and longer strings
    return values.sort((a, b) => {
      if (typeof a === 'string' && typeof b === 'string') {
        return b.length - a.length;
      }
      return 0;
    })[0];
  }

  /**
   * Calculate similarity between tokens in a group
   */
  private calculateGroupSimilarity(tokens: UnifiedToken[]): number {
    if (tokens.length < 2) return 1;

    // Compare names and symbols for similarity
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        const nameSimility = this.calculateStringSimilarity(tokens[i].name, tokens[j].name);
        const symbolSimilarity = this.calculateStringSimilarity(tokens[i].symbol, tokens[j].symbol);

        totalSimilarity += (nameSimility + symbolSimilarity) / 2;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  /**
   * Calculate string similarity using simple Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    if (s1 === s2) return 1;

    const maxLength = Math.max(s1.length, s2.length);
    if (maxLength === 0) return 1;

    // Simple character overlap calculation
    const overlap = this.calculateCharacterOverlap(s1, s2);
    return overlap / maxLength;
  }

  /**
   * Calculate character overlap between two strings
   */
  private calculateCharacterOverlap(str1: string, str2: string): number {
    const chars1 = new Set(str1);
    const chars2 = new Set(str2);

    let overlap = 0;
    chars1.forEach(char => {
      if (chars2.has(char)) {
        overlap++;
      }
    });

    return overlap;
  }

  /**
   * Calculate merged confidence score
   */
  private calculateMergedConfidence(tokens: UnifiedToken[]): number {
    // Base confidence on highest individual confidence + bonus for multiple sources
    const maxConfidence = Math.max(...tokens.map(t => t.confidence));
    const sourceBonus = Math.min(tokens.length * 5, 20); // Up to 20 bonus for multiple sources

    return Math.min(maxConfidence + sourceBonus, 100);
  }

  /**
   * Enhance tokens by updating their metadata after merging
   */
  private enhanceTokens(tokens: UnifiedToken[]): UnifiedToken[] {
    return tokens.map(token => {
      // Recalculate confidence for multi-source tokens
      if (token.sources.length > 1 && this.config.recalculateConfidence) {
        return {
          ...token,
          confidence: this.calculateMergedConfidence([token]),
          lastUpdated: new Date().toISOString(),
        };
      }
      return token;
    });
  }

  /**
   * Sort tokens by confidence and provider priority
   */
  private sortTokens(tokens: UnifiedToken[]): UnifiedToken[] {
    return tokens.sort((a, b) => {
      // 1. Confidence score
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }

      // 2. Verification status
      if (a.verified !== b.verified) {
        return b.verified ? 1 : -1;
      }

      // 3. Number of sources
      if (a.sources.length !== b.sources.length) {
        return b.sources.length - a.sources.length;
      }

      // 4. Alphabetical by symbol
      return a.symbol.localeCompare(b.symbol);
    });
  }
}

// Export singleton instance
export const tokenMerger = new TokenMerger();