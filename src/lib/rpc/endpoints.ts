// RPC endpoint configurations for all supported chains

import type { RpcEndpoint, ChainRpcConfig } from './types';

/**
 * Get environment-based RPC URLs
 */
function getEnvRpcUrl(chainKey: string): string | undefined {
  return typeof window !== 'undefined'
    ? (window as any)[`NEXT_PUBLIC_RPC_URL_${chainKey}`]
    : process.env[`NEXT_PUBLIC_RPC_URL_${chainKey}`];
}

/**
 * Build RPC endpoint list for a chain with fallback cascade
 */
function buildEndpoints(
  chainId: number,
  alchemyUrl?: string,
  publicUrls: string[] = []
): RpcEndpoint[] {
  const endpoints: RpcEndpoint[] = [];

  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_KEY;
  const ankrUrl = process.env.NEXT_PUBLIC_ANKR_ADVANCED_API_RPC_URL;

  // Priority 1: Custom RPC from environment (if provided)
  const chainKeys: Record<number, string> = {
    1: 'ETHEREUM',
    8453: 'BASE',
    137: 'POLYGON',
    42161: 'ARBITRUM',
    10: 'OPTIMISM',
    56: 'BSC',
    43114: 'AVALANCHE',
    2741: 'ABSTRACT',
  };

  const customUrl = chainKeys[chainId] ? getEnvRpcUrl(chainKeys[chainId]) : undefined;
  if (customUrl) {
    endpoints.push({
      url: customUrl,
      provider: 'custom',
      priority: 1,
    });
  }

  // Priority 2: Alchemy (if API key provided and URL exists)
  if (alchemyKey && alchemyUrl) {
    endpoints.push({
      url: alchemyUrl,
      provider: 'alchemy',
      priority: 2,
    });
  }

  // Priority 3: ANKR Advanced API (primary fallback)
  if (ankrUrl) {
    endpoints.push({
      url: `${ankrUrl}/${chainId}`,
      provider: 'ankr',
      priority: 3,
    });
  }

  // Priority 4+: Public RPCs (secondary fallbacks)
  publicUrls.forEach((url, index) => {
    endpoints.push({
      url,
      provider: 'public',
      priority: 4 + index,
    });
  });

  return endpoints;
}

/**
 * Get RPC configuration for a specific chain
 */
export function getChainRpcConfig(chainId: number): ChainRpcConfig | null {
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_KEY;

  const configs: Record<number, ChainRpcConfig> = {
    // Ethereum Mainnet
    1: {
      chainId: 1,
      endpoints: buildEndpoints(
        1,
        `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`,
        [
          'https://eth.llamarpc.com',
          'https://rpc.ankr.com/eth',
          'https://ethereum.publicnode.com',
        ]
      ),
    },

    // Ethereum Sepolia
    11155111: {
      chainId: 11155111,
      endpoints: buildEndpoints(
        11155111,
        `https://eth-sepolia.g.alchemy.com/v2/${alchemyKey}`,
        [
          'https://rpc.sepolia.org',
          'https://ethereum-sepolia.publicnode.com',
        ]
      ),
    },

    // Base Mainnet
    8453: {
      chainId: 8453,
      endpoints: buildEndpoints(
        8453,
        `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`,
        [
          'https://mainnet.base.org',
          'https://base.meowrpc.com',
          'https://base.llamarpc.com',
        ]
      ),
    },

    // Base Sepolia
    84532: {
      chainId: 84532,
      endpoints: buildEndpoints(
        84532,
        undefined, // Already using QuickNode
        [
          'https://holy-wiser-fog.base-sepolia.quiknode.pro/646da32894cdd82a4937d8fea8d65a16d754445f/',
          'https://sepolia.base.org',
        ]
      ),
    },

    // Polygon Mainnet
    137: {
      chainId: 137,
      endpoints: buildEndpoints(
        137,
        `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`,
        [
          'https://polygon-rpc.com',
          'https://rpc.ankr.com/polygon',
          'https://polygon.llamarpc.com',
        ]
      ),
    },

    // Polygon Amoy (testnet)
    80002: {
      chainId: 80002,
      endpoints: buildEndpoints(
        80002,
        `https://polygon-amoy.g.alchemy.com/v2/${alchemyKey}`,
        [
          'https://rpc-amoy.polygon.technology',
        ]
      ),
    },

    // Arbitrum One
    42161: {
      chainId: 42161,
      endpoints: buildEndpoints(
        42161,
        `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`,
        [
          'https://arb1.arbitrum.io/rpc',
          'https://rpc.ankr.com/arbitrum',
          'https://arbitrum.llamarpc.com',
        ]
      ),
    },

    // Arbitrum Sepolia
    421614: {
      chainId: 421614,
      endpoints: buildEndpoints(
        421614,
        `https://arb-sepolia.g.alchemy.com/v2/${alchemyKey}`,
        [
          'https://sepolia-rollup.arbitrum.io/rpc',
        ]
      ),
    },

    // Optimism Mainnet
    10: {
      chainId: 10,
      endpoints: buildEndpoints(
        10,
        `https://opt-mainnet.g.alchemy.com/v2/${alchemyKey}`,
        [
          'https://mainnet.optimism.io',
          'https://rpc.ankr.com/optimism',
          'https://optimism.llamarpc.com',
        ]
      ),
    },

    // Optimism Sepolia
    11155420: {
      chainId: 11155420,
      endpoints: buildEndpoints(
        11155420,
        `https://opt-sepolia.g.alchemy.com/v2/${alchemyKey}`,
        [
          'https://sepolia.optimism.io',
        ]
      ),
    },

    // BSC Mainnet
    56: {
      chainId: 56,
      endpoints: buildEndpoints(
        56,
        `https://bnb-mainnet.g.alchemy.com/v2/${alchemyKey}`,
        [
          'https://bsc-dataseed.binance.org',
          'https://rpc.ankr.com/bsc',
          'https://bsc.meowrpc.com',
        ]
      ),
    },

    // BSC Testnet
    97: {
      chainId: 97,
      endpoints: buildEndpoints(
        97,
        `https://bnb-testnet.g.alchemy.com/v2/${alchemyKey}`,
        [
          'https://data-seed-prebsc-1-s1.binance.org:8545',
        ]
      ),
    },

    // Avalanche C-Chain
    43114: {
      chainId: 43114,
      endpoints: buildEndpoints(
        43114,
        undefined, // Alchemy doesn't support Avalanche
        [
          'https://api.avax.network/ext/bc/C/rpc',
          'https://rpc.ankr.com/avalanche',
          'https://avalanche.publicnode.com',
        ]
      ),
    },

    // Avalanche Fuji (testnet)
    43113: {
      chainId: 43113,
      endpoints: buildEndpoints(
        43113,
        undefined,
        [
          'https://api.avax-test.network/ext/bc/C/rpc',
        ]
      ),
    },

    // Abstract Mainnet
    2741: {
      chainId: 2741,
      endpoints: buildEndpoints(
        2741,
        `https://abstract-mainnet.g.alchemy.com/v2/${alchemyKey}`,
        [
          // Add Abstract public RPCs when available
        ]
      ),
    },

    // Abstract Testnet
    11124: {
      chainId: 11124,
      endpoints: buildEndpoints(
        11124,
        `https://abstract-testnet.g.alchemy.com/v2/${alchemyKey}`,
        [
          // Add Abstract testnet public RPCs when available
        ]
      ),
    },

    // Lisk Mainnet (uses Moralis, not Alchemy)
    1135: {
      chainId: 1135,
      endpoints: [
        {
          url: `https://site1.moralis-nodes.com/lisk/${process.env.NEXT_PUBLIC_LISK_MAINNET}`,
          provider: 'custom',
          priority: 1,
        },
      ],
    },

    // Lisk Sepolia (uses Moralis, not Alchemy)
    4202: {
      chainId: 4202,
      endpoints: [
        {
          url: `https://site1.moralis-nodes.com/lisk-sepolia/${process.env.NEXT_PUBLIC_LISK_TESTNET}`,
          provider: 'custom',
          priority: 1,
        },
      ],
    },
  };

  return configs[chainId] || null;
}

/**
 * Get primary RPC URL for a chain (highest priority endpoint)
 */
export function getPrimaryRpcUrl(chainId: number): string {
  const config = getChainRpcConfig(chainId);
  if (!config || config.endpoints.length === 0) {
    console.warn(`No RPC config found for chain ${chainId}, using fallback`);
    return 'https://rpc.ankr.com/eth';
  }

  // Return highest priority endpoint
  const sorted = config.endpoints.sort((a, b) => a.priority - b.priority);
  return sorted[0].url;
}
