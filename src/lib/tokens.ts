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

/**
 * Base Sepolia token registry
 * This is a small subset for MVP - in production this would be fetched from a token list API
 */
const BASE_SEPOLIA_TOKENS: Token[] = [
  {
    id: 1,
    chainId: 84532,
    address: "0x0000000000000000000000000000000000000000", // Native ETH
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    verified: true,
  },
  {
    id: 2,
    chainId: 84532,
    address: "0x4A3A6Dd60A34bB2Aba60D73B4C88315E9CeB6A3D", // Example USDC on Base Sepolia
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    logoURI: "https://coin-images.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
    verified: true,
  },
  {
    id: 3,
    chainId: 84532,
    address: "0x853154e2A5604E5C74a2546E2871Ad44932eB92C", // Example WETH on Base Sepolia
    name: "Wrapped Ethereum",
    symbol: "WETH",
    decimals: 18,
    logoURI: "https://coin-images.coingecko.com/coins/images/2518/small/weth.png",
    verified: true,
  },
  {
    id: 4,
    chainId: 84532,
    address: "0x7b4adf64b0d60ff97d672e473420203d52562a84", // Example DAI on Base Sepolia
    name: "Dai Stablecoin",
    symbol: "DAI",
    decimals: 18,
    logoURI: "https://coin-images.coingecko.com/coins/images/9956/small/dai-multi-collateral-mcd.png",
    verified: true,
  },
  {
    id: 5,
    chainId: 84532,
    address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Example unverified ETH-like token
    name: "Ethereum Classic",
    symbol: "ETC",
    decimals: 18,
    verified: false,
  },
];

/**
 * Base mainnet token registry (smaller subset for MVP)
 */
const BASE_MAINNET_TOKENS: Token[] = [
  {
    id: 1,
    chainId: 8453,
    address: "0x0000000000000000000000000000000000000000", // Native ETH
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    verified: true,
  },
  {
    id: 2,
    chainId: 8453,
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    logoURI: "https://coin-images.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
    verified: true,
  },
  {
    id: 3,
    chainId: 8453,
    address: "0x4200000000000000000000000000000000000006", // WETH on Base
    name: "Wrapped Ethereum",
    symbol: "WETH",
    decimals: 18,
    logoURI: "https://coin-images.coingecko.com/coins/images/2518/small/weth.png",
    verified: true,
  },
];

/**
 * All tokens registry by chain
 */
const TOKEN_REGISTRY: Record<number, Token[]> = {
  84532: BASE_SEPOLIA_TOKENS, // Base Sepolia
  8453: BASE_MAINNET_TOKENS,  // Base Mainnet
};

/**
 * Search for tokens by symbol with fuzzy matching
 */
export function searchTokensBySymbol(symbol: string, chainId: number): Token[] {
  const tokens = TOKEN_REGISTRY[chainId] || [];
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
  const tokens = TOKEN_REGISTRY[chainId] || [];
  return tokens.find(token =>
    token.address.toLowerCase() === address.toLowerCase()
  );
}

/**
 * Get native token for chain
 */
export function getNativeToken(chainId: number): Token | undefined {
  const tokens = TOKEN_REGISTRY[chainId] || [];
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
  return TOKEN_REGISTRY[chainId] || [];
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
  const chainName = chainId === 84532 ? "Base Sepolia" : chainId === 8453 ? "Base" : `Chain ${chainId}`;
  return {
    needsSelection: true,
    message: `Found ${matches.length} tokens matching "${symbol}" on ${chainName}. Please select:`,
    tokens: matches,
  };
}