// lib/tokens.ts - Token registry and search functionality

export interface Token {
  id: number;
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  verified?: boolean;
}

// Token definitions moved to centralized chain registry
// Import getChainConfig to access token data from registry

import { getChainConfig } from "./chains/registry";

/**
 * Get tokens for a chain from centralized registry
 */
function getTokenRegistryForChain(chainId: number): Token[] {
  const chainConfig = getChainConfig(chainId);
  return chainConfig?.tokens || [];
}

/**
 * Search for tokens by symbol with fuzzy matching
 */
export function searchTokensBySymbol(symbol: string, chainId: number): Token[] {
  const tokens = getTokenRegistryForChain(chainId);
  const searchTerm = symbol.toLowerCase();

  // Exact match first
  const exactMatches = tokens.filter(token =>
    token.symbol.toLowerCase() === searchTerm
  );

  // Partial matches
  const partialMatches = tokens.filter(token =>
    token.symbol.toLowerCase() !== searchTerm &&
    token.symbol.toLowerCase().includes(searchTerm)
  );

  // Name matches
  const nameMatches = tokens.filter(token =>
    !token.symbol.toLowerCase().includes(searchTerm) &&
    token.name.toLowerCase().includes(searchTerm)
  );

  // Combine and deduplicate
  const allMatches = [...exactMatches, ...partialMatches, ...nameMatches];
  const uniqueMatches = allMatches.filter((token, index, self) =>
    index === self.findIndex(t => t.address === token.address)
  );

  return uniqueMatches;
}

/**
 * Get token by address
 */
export function getTokenByAddress(address: string, chainId: number): Token | undefined {
  const tokens = getTokenRegistryForChain(chainId);
  return tokens.find(token =>
    token.address.toLowerCase() === address.toLowerCase()
  );
}

/**
 * Get native token for chain
 */
export function getNativeToken(chainId: number): Token | undefined {
  const tokens = getTokenRegistryForChain(chainId);
  return tokens.find(token =>
    token.address === "0x0000000000000000000000000000000000000000"
  );
}

/**
 * Check if a token symbol is ambiguous (multiple matches)
 */
export function isTokenSymbolAmbiguous(symbol: string, chainId: number): boolean {
  const matches = searchTokensBySymbol(symbol, chainId);
  return matches.length > 1;
}

/**
 * Get all tokens for a chain
 */
export function getTokensForChain(chainId: number): Token[] {
  return getTokenRegistryForChain(chainId);
}

/**
 * Token selection response for ambiguous symbols
 */
export interface TokenSelectionResponse {
  needsSelection: true;
  message: string;
  tokens: Token[];
}

/**
 * Token resolution response for unambiguous symbols
 */
export interface TokenResolutionResponse {
  needsSelection: false;
  token: Token;
}

/**
 * Union type for token resolution results
 */
export type TokenResolutionResult = TokenSelectionResponse | TokenResolutionResponse;

/**
 * Resolve token symbol to either a single token or a selection list
 */
export function resolveTokenSymbol(symbol: string, chainId: number): TokenResolutionResult {
  const matches = searchTokensBySymbol(symbol, chainId);

  if (matches.length === 0) {
    throw new Error(`No tokens found matching "${symbol}" on chain ${chainId}`);
  }

  if (matches.length === 1) {
    return {
      needsSelection: false,
      token: matches[0],
    };
  }

  // Multiple matches - need user selection
  const chainConfig = getChainConfig(chainId);
  const chainName = chainConfig?.name || `Chain ${chainId}`;
  return {
    needsSelection: true,
    message: `Found ${matches.length} tokens matching "${symbol}" on ${chainName}. Please select:`,
    tokens: matches,
  };
}