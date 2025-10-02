// lib/chains/registry.ts - Centralized chain configuration registry

import { Chain } from "viem/chains";
import {
  base, // base mainnet
  baseSepolia, // base testnet sepolia
  mainnet, // eth mainnet
  sepolia, // eth testnet sepolia
  polygon, // polygon mainnet
  polygonAmoy, // polygon testnet amoy
  arbitrum, // arbitrum mainnet
  arbitrumSepolia, // arbitrum testnet sepolia
  optimism, // optimism mainnet
  optimismSepolia, // optimism testnet sepolia
  avalanche, // avax mainnet
  avalancheFuji, // avax testnet fuji
  bsc, // bsc mainnet
  bscTestnet, // bsc testnet
  abstract, // abstract mainnet
  abstractTestnet, // asbtract testnet
  lisk, // lisk mainnet
  liskSepolia, // listk testnet sepolia
} from "viem/chains";
import type { Token } from "../tokens";

export interface ChainConfig {
  id: number;
  name: string;
  symbol: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrl: string;
  explorerUrl: string;
  explorerName: string;
  wagmiChain: Chain;
  supported: boolean;
  isTestnet: boolean;
  tokens: Token[];
}

/**
 * Environment-based RPC URL generation
 */
function getRpcUrl(chainId: number, fallbackUrl?: string): string {
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_KEY;
  const moralisMainnetKey = process.env.NEXT_PUBLIC_LISK_MAINNET;
  const moralisTesnetKey = process.env.NEXT_PUBLIC_LISK_TESTNET;

  const alchemyUrls: Record<number, string> = {
    // base
    8453: `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    84532: `https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`,

    // eth
    1: `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    11155111: `https://eth-sepolia.g.alchemy.com/v2/${alchemyKey}`,

    // polygon
    137: `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    80001: `https://polygon-mumbai.g.alchemy.com/v2/${alchemyKey}`,
    80002: `https://polygon-amoy.g.alchemy.com/v2/${alchemyKey}`,

    // arbitrum
    42161: `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`,

    // optimism
    10: `https://opt-mainnet.g.alchemy.com/v2/${alchemyKey}`,

    // avax

    // bsc
    56: `https://bnb-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    97: `https://bnb-testnet.g.alchemy.com/v2/${alchemyKey}`,

    // abstract
    2741: `https://abstract-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    11124: `https://abstract-testnet.g.alchemy.com/v2/${alchemyKey}`,

    // lisk
    1135: `https://site1.moralis-nodes.com/lisk/${moralisMainnetKey}`,
    4202: `https://site1.moralis-nodes.com/lisk-sepolia/${moralisTesnetKey}`,
  };

  if (alchemyKey && alchemyUrls[chainId]) {
    return alchemyUrls[chainId];
  }

  return fallbackUrl || `https://rpc.ankr.com/eth`;
}

/**
 * Base tokens for Base mainnet
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
    logoURI:
      "https://coin-images.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
    verified: true,
  },
  {
    id: 3,
    chainId: 8453,
    address: "0x4200000000000000000000000000000000000006", // WETH on Base
    name: "Wrapped Ethereum",
    symbol: "WETH",
    decimals: 18,
    logoURI:
      "https://coin-images.coingecko.com/coins/images/2518/small/weth.png",
    verified: true,
  },
];

/**
 * Base tokens for Base Sepolia testnet
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
    logoURI:
      "https://coin-images.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
    verified: true,
  },
  {
    id: 3,
    chainId: 84532,
    address: "0x853154e2A5604E5C74a2546E2871Ad44932eB92C", // Example WETH on Base Sepolia
    name: "Wrapped Ethereum",
    symbol: "WETH",
    decimals: 18,
    logoURI:
      "https://coin-images.coingecko.com/coins/images/2518/small/weth.png",
    verified: true,
  },
];

/**
 * Ethereum mainnet tokens
 */
const ETHEREUM_MAINNET_TOKENS: Token[] = [
  {
    id: 1,
    chainId: 1,
    address: "0x0000000000000000000000000000000000000000", // Native ETH
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    verified: true,
  },
  {
    id: 2,
    chainId: 1,
    address: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC on Ethereum
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    verified: true,
  },
];

/**
 * Default tokens for other chains (ETH native only)
 */
function getDefaultTokens(chainId: number): Token[] {
  return [
    {
      id: 1,
      chainId,
      address: "0x0000000000000000000000000000000000000000",
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      verified: true,
    },
  ];
}

/**
 * Complete chain registry - single source of truth
 */
export const CHAIN_REGISTRY: Record<number, ChainConfig> = {
  // Base Mainnet - Primary supported chain
  8453: {
    id: 8453,
    name: "Base",
    symbol: "ETH",
    nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
    rpcUrl: getRpcUrl(8453, base?.rpcUrls?.default?.http?.[0]),
    explorerUrl: base?.blockExplorers?.default?.url,
    explorerName: "BaseScan",
    wagmiChain: base,
    supported: true,
    isTestnet: false,
    tokens: BASE_MAINNET_TOKENS,
  },

  // Base Sepolia - Primary testnet
  84532: {
    id: 84532,
    name: "Base Sepolia",
    symbol: "ETH",
    nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
    rpcUrl: getRpcUrl(84532, baseSepolia?.rpcUrls?.default?.http?.[0]),
    explorerUrl: baseSepolia?.blockExplorers?.default?.url,
    explorerName: "BaseScan Sepolia",
    wagmiChain: baseSepolia,
    supported: true,
    isTestnet: true,
    tokens: BASE_SEPOLIA_TOKENS,
  },

  // Ethereum Mainnet
  1: {
    id: 1,
    name: "Ethereum",
    symbol: "ETH",
    nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
    rpcUrl: getRpcUrl(1, mainnet?.rpcUrls?.default?.http?.[0]),
    explorerUrl: mainnet?.blockExplorers?.default?.url,
    explorerName: "Etherscan",
    wagmiChain: mainnet,
    supported: true,
    isTestnet: false,
    tokens: ETHEREUM_MAINNET_TOKENS,
  },

  // Ethereum Sepolia
  11155111: {
    id: 11155111,
    name: "Ethereum Sepolia",
    symbol: "ETH",
    nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
    rpcUrl: getRpcUrl(11155111, sepolia?.rpcUrls?.default?.http?.[0]),
    explorerUrl: sepolia?.blockExplorers?.default?.url,
    explorerName: "Etherscan Sepolia",
    wagmiChain: sepolia,
    supported: true,
    isTestnet: true,
    tokens: getDefaultTokens(11155111),
  },

  // Polygon
  137: {
    id: 137,
    name: "Polygon",
    symbol: "MATIC",
    nativeCurrency: { name: "Polygon", symbol: "MATIC", decimals: 18 },
    rpcUrl: getRpcUrl(137, polygon?.rpcUrls?.default?.http?.[0]),
    explorerUrl: polygon?.blockExplorers?.default?.url,
    explorerName: "PolygonScan",
    wagmiChain: polygon,
    supported: true,
    isTestnet: false,
    tokens: getDefaultTokens(137),
  }, // Polygon amoy

  // Arbitrum One
  42161: {
    id: 42161,
    name: "Arbitrum One",
    symbol: "ETH",
    nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
    rpcUrl: getRpcUrl(42161, arbitrum?.rpcUrls?.default?.http?.[0]),
    explorerUrl: arbitrum?.blockExplorers?.default?.url,
    explorerName: "Arbiscan",
    wagmiChain: arbitrum,
    supported: true,
    isTestnet: false,
    tokens: getDefaultTokens(42161),
  },

  // Optimism
  10: {
    id: 10,
    name: "Optimism",
    symbol: "ETH",
    nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
    rpcUrl: getRpcUrl(10, optimism?.rpcUrls?.default?.http?.[0]),
    explorerUrl: optimism?.blockExplorers?.default?.url,
    explorerName: "Optimistic Etherscan",
    wagmiChain: optimism,
    supported: true,
    isTestnet: false,
    tokens: getDefaultTokens(10),
  },

  // Avalanche
  43114: {
    id: 43114,
    name: "Avalanche",
    symbol: "AVAX",
    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    rpcUrl: getRpcUrl(43114, avalanche?.rpcUrls?.default?.http?.[0]),
    explorerUrl: avalanche?.blockExplorers?.default?.url,
    explorerName: "Snowtrace",
    wagmiChain: avalanche,
    supported: true,
    isTestnet: false,
    tokens: getDefaultTokens(43114),
  },
  // --- Binance Smart Chain (BSC Mainnet) ---
  56: {
    id: 56,
    name: "BNB Smart Chain",
    symbol: "BNB",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrl: getRpcUrl(56, bsc?.rpcUrls?.default?.http?.[0]),
    explorerUrl: bsc?.blockExplorers?.default?.url,
    explorerName: "BscScan",
    wagmiChain: bsc,
    supported: true,
    isTestnet: false,
    tokens: getDefaultTokens(56),
  },

  // --- BSC Testnet ---
  97: {
    id: 97,
    name: "BNB Smart Chain Testnet",
    symbol: "tBNB",
    nativeCurrency: { name: "BNB Testnet", symbol: "tBNB", decimals: 18 },
    rpcUrl: getRpcUrl(97, bscTestnet?.rpcUrls?.default?.http?.[0]),
    explorerUrl: bscTestnet?.blockExplorers?.default?.url,
    explorerName: "BscScan Testnet",
    wagmiChain: bscTestnet,
    supported: true,
    isTestnet: true,
    tokens: getDefaultTokens(97),
  },

  // --- Abstract Mainnet ---
  2741: {
    id: 2741,
    name: "Abstract",
    symbol: "ABT",
    nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
    rpcUrl: getRpcUrl(2741, abstract?.rpcUrls?.default?.http?.[0]),
    explorerUrl: abstract?.blockExplorers?.default?.url,
    explorerName: "Abstract Explorer",
    wagmiChain: abstract,
    supported: true,
    isTestnet: false,
    tokens: getDefaultTokens(2741),
  }, // --- Abstract testnet ---
  11124: {
    id: 11124,
    name: "Abstract",
    symbol: "ABT",
    nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
    rpcUrl: getRpcUrl(11124, abstractTestnet?.rpcUrls?.default?.http?.[0]),
    explorerUrl: abstractTestnet?.blockExplorers?.default?.url,
    explorerName: "Abstract Explorer",
    wagmiChain: abstractTestnet,
    supported: true,
    isTestnet: true,
    tokens: getDefaultTokens(11124),
  },

  // --- Lisk Mainnet ---
  1135: {
    id: 1135,
    name: "Lisk",
    symbol: "LSK",
    nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
    rpcUrl: getRpcUrl(1135, lisk?.rpcUrls?.default?.http?.[0]),
    explorerUrl: lisk?.blockExplorers?.default?.url,
    explorerName: "Lisk Explorer",
    wagmiChain: lisk,
    supported: true,
    isTestnet: false,
    tokens: getDefaultTokens(1135),
  },
};

/**
 * Default chain ID - always Base mainnet
 */
export const DEFAULT_CHAIN_ID = 8453;

/**
 * Get chain configuration by ID
 */
export function getChainConfig(chainId: number): ChainConfig | undefined {
  return CHAIN_REGISTRY[chainId];
}

/**
 * Get supported chains only
 */
export function getSupportedChains(): ChainConfig[] {
  return Object.values(CHAIN_REGISTRY).filter((chain) => chain.supported);
}

/**
 * Get mainnet chains only
 */
export function getMainnetChains(): ChainConfig[] {
  return getSupportedChains().filter((chain) => !chain.isTestnet);
}

/**
 * Get testnet chains only
 */
export function getTestnetChains(): ChainConfig[] {
  return getSupportedChains().filter((chain) => chain.isTestnet);
}

/**
 * Resolve chain name/ID to chain config
 */
export function resolveChain(chainInput: string | number): ChainConfig {
  if (typeof chainInput === "number") {
    const config = getChainConfig(chainInput);
    if (!config) {
      throw new Error(`Unsupported chain ID: ${chainInput}`);
    }
    return config;
  }

  // String-based resolution
  const chainName = chainInput.toLowerCase();
  const chainMappings: Record<string, number> = {
    // Base
    base: 8453,
    "base-mainnet": 8453,
    basemainnet: 8453,
    "base-sepolia": 84532,
    baseseoplia: 84532,
    basetestnet: 84532,

    // Ethereum
    ethereum: 1,
    mainnet: 1,
    eth: 1,
    sepolia: 11155111,
    "eth-sepolia": 11155111,

    // Polygon
    polygon: 137,
    matic: 137,
    amoy: 80002,
    "polygon-amoy": 80002,

    // Arbitrum
    arbitrum: 42161,
    arb: 42161,
    arbitrumone: 42161,

    // Optimism
    optimism: 10,
    op: 10,

    // Avalanche
    avalanche: 43114,
    avax: 43114,

    // BNB Chain
    bnb: 56,
    bsc: 56,
    "bnb-chain": 56,
    "bsc-testnet": 97,
    tbnb: 97,

    // Abstract
    abstract: 2741,
    abs: 2741,
    "abstract-sepolia": 11124,
    "abs-sepolia": 11124,

    // Lisk
    lisk: 1135,
    lsk: 1135,
    "lisk-sepolia": 4202,
  };

  const chainId = chainMappings[chainName];
  if (!chainId) {
    throw new Error(
      `Unsupported chain: ${chainInput}. Use: base, ethereum, polygon, arbitrum, optimism, avalanche`,
    );
  }

  return resolveChain(chainId);
}

/**
 * Check if chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  const config = getChainConfig(chainId);
  return config?.supported ?? false;
}

/**
 * Get all wagmi chains for configuration
 */
export function getAllWagmiChains(): Chain[] {
  return getSupportedChains().map((chain) => chain.wagmiChain);
}

/**
 * Get chain name for display
 */
export function getChainDisplayName(chainId: number): string {
  const config = getChainConfig(chainId);
  return config?.name ?? `Chain ${chainId}`;
}

/**
 * Get explorer URL for transaction
 */
export function getExplorerTxUrl(chainId: number, txHash: string): string {
  const config = getChainConfig(chainId);
  if (!config) {
    return `#${txHash}`;
  }
  return `${config.explorerUrl}/tx/${txHash}`;
}

/**
 * Get explorer URL for address
 */
export function getExplorerAddressUrl(
  chainId: number,
  address: string,
): string {
  const config = getChainConfig(chainId);
  if (!config) {
    return `#${address}`;
  }
  return `${config.explorerUrl}/address/${address}`;
}

/**
 * Format success message with chain context
 */
export function formatChainSuccessMessage(
  amount: string,
  chainId: number,
  txHash: string,
): string {
  const config = getChainConfig(chainId);
  const chainName = config?.name || `Chain ${chainId}`;
  const symbol = config?.nativeCurrency.symbol || "ETH";

  return `✅ Sent ${amount} ${symbol} on ${chainName} — hash ${txHash}`;
}
