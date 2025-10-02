// Portfolio service for multi-chain token balance fetching
import { getWalletBalances, createConfig, EVM } from "@lifi/sdk";
import { formatUnits } from "viem";
import { getSupportedChains } from "@/lib/chains/registry";

export type PortfolioToken = {
  chainId: number;
  chainName: string;
  symbol: string;
  name: string;
  decimals: number;
  rawAmount: bigint;
  formattedAmount: string;
  priceUsd?: number;
  usdValue: number;
  address: `0x${string}`;
  logoURI?: string;
};

export type PortfolioSnapshot = {
  address: `0x${string}`;
  fetchedAt: number;
  tokens: PortfolioToken[];
};

export type TokenPosition = {
  chainId: number;
  chainName: string;
  balance: string;
  usdValue: number;
  address: `0x${string}`;
};

export type AggregatedToken = {
  symbol: string;
  name: string;
  totalUsdValue: number;
  totalBalance: string;
  portfolioPercentage: number;
  positions: TokenPosition[];
  priceUsd?: number;
  logoURI?: string;
};

export type ChainAllocation = {
  chainId: number;
  chainName: string;
  usdValue: number;
  percentage: number;
  tokenCount: number;
};

export type PortfolioInsight = {
  type: 'concentration' | 'diversification' | 'chain-balance' | 'opportunity';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  actionable?: string;
};

export type PortfolioSummary = {
  address: `0x${string}`;
  fetchedAt: number;
  totalUsdValue: number;
  uniqueTokens: number;
  totalPositions: number;
  activeChains: number;
  topHoldings: AggregatedToken[];
  chainDistribution: ChainAllocation[];
  insights: PortfolioInsight[];
  rawTokens: PortfolioToken[];
};

// In-memory cache with TTL
interface CacheEntry {
  snapshot: PortfolioSnapshot;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 20 * 1000; // 20 seconds

// LiFi SDK configuration state
let lifiInitialized = false;

/**
 * Ensure LiFi SDK is configured exactly once
 */
export function ensureLifiConfigured(): void {
  if (lifiInitialized) return;

  try {
    const supportedChains = getSupportedChains();

    // Build RPC URL map
    const rpcUrls: Record<number, string> = {};
    supportedChains.forEach(chain => {
      if (chain.supported && chain.rpcUrl) {
        rpcUrls[chain.id] = chain.rpcUrl;
      }
    });

    // Initialize LiFi config with API key
    const apiKey = process.env.NEXT_PUBLIC_LIFI_API_KEY || process.env.LIFI_API_KEY;
    createConfig({
      integrator: 'execfi-cli',
      apiUrl: process.env.LIFI_API_URL || 'https://li.quest/v1',
      rpcUrls,
      providers: [EVM()],
      disableVersionCheck: true,
      ...(apiKey && { apiKey }),
    });

    lifiInitialized = true;
    console.log('✅ LiFi SDK configured successfully');
  } catch (error) {
    console.error('❌ Failed to configure LiFi SDK:', error);
    // Don't throw - let fallback handle it
  }
}

/**
 * Generate cache key for portfolio snapshot
 */
function getCacheKey(address: `0x${string}`, chainIds: number[]): string {
  return `${address}-${chainIds.sort().join(',')}`;
}

/**
 * Clean expired entries from cache
 */
function cleanCache(): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key);
    }
  }
}

/**
 * Normalize token amount for display
 */
function normalizeTokenAmount(
  rawAmount: string | bigint,
  decimals: number
): { raw: bigint; formatted: string } {
  const raw = typeof rawAmount === 'string' ? BigInt(rawAmount) : rawAmount;
  const formatted = formatUnits(raw, decimals);

  // Cap to 8 decimals for display
  const num = parseFloat(formatted);
  const cappedFormatted = num.toFixed(8).replace(/\.?0+$/, '');

  return { raw, formatted: cappedFormatted };
}

/**
 * Fallback RPC balance fetcher using viem
 */
async function fallbackChainSnapshot(
  address: `0x${string}`,
  chainIds: number[]
): Promise<PortfolioToken[]> {
  console.log('🔄 Falling back to RPC balance fetching for chains:', chainIds);

  const supportedChains = getSupportedChains();
  const tokens: PortfolioToken[] = [];

  for (const chainId of chainIds) {
    const chainConfig = supportedChains.find(c => c.id === chainId);
    if (!chainConfig || !chainConfig.supported) continue;

    try {
      const { createPublicClient, http } = await import('viem');

      const client = createPublicClient({
        chain: chainConfig.wagmiChain,
        transport: http(chainConfig.rpcUrl),
      });

      // Fetch native balance
      const nativeBalance = await client.getBalance({ address });
      if (nativeBalance > 0n) {
        const { raw, formatted } = normalizeTokenAmount(nativeBalance, 18);

        tokens.push({
          chainId,
          chainName: chainConfig.name,
          symbol: chainConfig.nativeCurrency.symbol,
          name: chainConfig.nativeCurrency.name,
          decimals: chainConfig.nativeCurrency.decimals,
          rawAmount: raw,
          formattedAmount: formatted,
          usdValue: 0, // No price data in fallback
          address: '0x0000000000000000000000000000000000000000',
        });
      }

      // Fetch ERC-20 token balances using multicall
      if (chainConfig.tokens && chainConfig.tokens.length > 0) {
        const erc20Abi = [
          {
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: 'balance', type: 'uint256' }],
          },
        ] as const;

        const contracts = chainConfig.tokens.map(token => ({
          address: token.address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address],
        }));

        try {
          const balances = await client.multicall({ contracts });

          for (let i = 0; i < balances.length; i++) {
            const result = balances[i];
            const token = chainConfig.tokens[i];

            if (result.status === 'success' && result.result > 0n) {
              const { raw, formatted } = normalizeTokenAmount(result.result, token.decimals);

              tokens.push({
                chainId,
                chainName: chainConfig.name,
                symbol: token.symbol,
                name: token.name,
                decimals: token.decimals,
                rawAmount: raw,
                formattedAmount: formatted,
                usdValue: 0, // No price data in fallback
                address: token.address as `0x${string}`,
                logoURI: token.logoURI,
              });
            }
          }
        } catch (multicallError) {
          console.warn(`⚠️ Multicall failed for chain ${chainId}:`, multicallError);
        }
      }
    } catch (chainError) {
      console.warn(`⚠️ Failed to fetch balances for chain ${chainId}:`, chainError);
    }
  }

  console.log(`✅ Fallback fetched ${tokens.length} tokens across ${chainIds.length} chains`);
  return tokens;
}

/**
 * Fetch portfolio snapshot using LiFi SDK with fallback
 */
export async function fetchPortfolioSnapshot(params: {
  address: `0x${string}`;
  chainIds?: number[];
  abortSignal?: AbortSignal;
}): Promise<PortfolioSnapshot> {
  const { address, chainIds: requestedChainIds } = params;

  // Default to supported chains or use provided ones
  const supportedChains = getSupportedChains().filter(c => c.supported && !c.isTestnet);
  const chainIds = requestedChainIds || [supportedChains[0]?.id || 8453]; // Default to Base

  // Check cache first
  cleanCache();
  const cacheKey = getCacheKey(address, chainIds);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    console.log('✅ Returning cached portfolio snapshot');
    return cached.snapshot;
  }

  console.log(`🔄 Fetching portfolio for ${address} on chains: ${chainIds.join(', ')}`);

  try {
    // Ensure LiFi is configured
    ensureLifiConfigured();

    // Try LiFi SDK first (extended is automatically enabled in SDK)
    const balanceResults = await getWalletBalances(address);

    const tokens: PortfolioToken[] = [];

    if (balanceResults && typeof balanceResults === 'object') {
      // Process LiFi balance results
      for (const [chainIdStr, chainBalances] of Object.entries(balanceResults)) {
        const chainId = parseInt(chainIdStr);

        // Filter to requested chains only
        if (!chainIds.includes(chainId)) continue;

        const chainConfig = supportedChains.find(c => c.id === chainId);
        if (!chainConfig || !Array.isArray(chainBalances)) continue;

        for (const tokenData of chainBalances) {
          if (!tokenData || typeof tokenData !== 'object') continue;

          const {
            amount,
            symbol,
            name,
            decimals,
            address,
            priceUSD,
            logoURI,
          } = tokenData as any;

          if (!amount || !symbol) continue;

          try {
            const { raw, formatted } = normalizeTokenAmount(amount, decimals || 18);

            // Skip zero balances
            if (raw === 0n) continue;

            // Calculate USD value if price available
            const priceUsd = priceUSD ? parseFloat(priceUSD) : undefined;
            const usdValue = priceUsd ? priceUsd * parseFloat(formatted) : 0;

            tokens.push({
              chainId,
              chainName: chainConfig.name,
              symbol: symbol || 'UNKNOWN',
              name: name || 'Unknown Token',
              decimals: decimals || 18,
              rawAmount: raw,
              formattedAmount: formatted,
              priceUsd,
              usdValue,
              address: address as `0x${string}`,
              logoURI,
            });
          } catch (tokenError) {
            console.warn('⚠️ Failed to process token:', tokenData, tokenError);
          }
        }
      }
    }

    // Sort by USD value descending, then by formatted amount
    tokens.sort((a, b) => {
      if (b.usdValue !== a.usdValue) {
        return b.usdValue - a.usdValue;
      }
      return parseFloat(b.formattedAmount) - parseFloat(a.formattedAmount);
    });

    const snapshot: PortfolioSnapshot = {
      address,
      fetchedAt: Date.now(),
      tokens,
    };

    // Cache the result
    cache.set(cacheKey, {
      snapshot,
      expiresAt: Date.now() + CACHE_TTL,
    });

    console.log(`✅ LiFi SDK fetched ${tokens.length} tokens successfully`);
    return snapshot;

  } catch (lifiError) {
    console.warn('⚠️ LiFi SDK failed, falling back to RPC:', lifiError);

    // Fallback to direct RPC calls
    try {
      const fallbackTokens = await fallbackChainSnapshot(address, chainIds);

      // Sort by formatted amount since no USD data
      fallbackTokens.sort((a, b) => parseFloat(b.formattedAmount) - parseFloat(a.formattedAmount));

      const snapshot: PortfolioSnapshot = {
        address,
        fetchedAt: Date.now(),
        tokens: fallbackTokens,
      };

      // Cache fallback result with shorter TTL
      cache.set(cacheKey, {
        snapshot,
        expiresAt: Date.now() + (CACHE_TTL / 2),
      });

      return snapshot;
    } catch (fallbackError) {
      console.error('❌ Both LiFi and RPC fallback failed:', fallbackError);
      throw new Error(`Failed to fetch portfolio: LiFi error: ${lifiError instanceof Error ? lifiError.message : 'Unknown'}. RPC fallback error: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown'}`);
    }
  }
}

/**
 * Aggregate tokens by symbol across chains
 */
function aggregateTokensBySymbol(tokens: PortfolioToken[]): AggregatedToken[] {
  const symbolMap = new Map<string, AggregatedToken>();

  for (const token of tokens) {
    const existing = symbolMap.get(token.symbol);
    if (existing) {
      // Aggregate balances for same token across chains
      existing.totalUsdValue += token.usdValue;
      existing.positions.push({
        chainId: token.chainId,
        chainName: token.chainName,
        balance: token.formattedAmount,
        usdValue: token.usdValue,
        address: token.address,
      });

      // Update price if we have it and didn't before
      if (token.priceUsd && !existing.priceUsd) {
        existing.priceUsd = token.priceUsd;
      }

      // Update logo if we have it and didn't before
      if (token.logoURI && !existing.logoURI) {
        existing.logoURI = token.logoURI;
      }
    } else {
      // Create new aggregated token entry
      symbolMap.set(token.symbol, {
        symbol: token.symbol,
        name: token.name,
        totalUsdValue: token.usdValue,
        totalBalance: token.formattedAmount,
        portfolioPercentage: 0, // Calculated later
        positions: [{
          chainId: token.chainId,
          chainName: token.chainName,
          balance: token.formattedAmount,
          usdValue: token.usdValue,
          address: token.address,
        }],
        priceUsd: token.priceUsd,
        logoURI: token.logoURI,
      });
    }
  }

  return Array.from(symbolMap.values());
}

/**
 * Calculate chain distribution from tokens
 */
function calculateChainDistribution(tokens: PortfolioToken[], totalUsdValue: number): ChainAllocation[] {
  const chainMap = new Map<number, ChainAllocation>();

  for (const token of tokens) {
    const existing = chainMap.get(token.chainId);
    if (existing) {
      existing.usdValue += token.usdValue;
      existing.tokenCount++;
    } else {
      chainMap.set(token.chainId, {
        chainId: token.chainId,
        chainName: token.chainName,
        usdValue: token.usdValue,
        percentage: 0, // Calculated later
        tokenCount: 1,
      });
    }
  }

  // Calculate percentages and sort by USD value
  const distributions = Array.from(chainMap.values());
  distributions.forEach(chain => {
    chain.percentage = totalUsdValue > 0 ? (chain.usdValue / totalUsdValue) * 100 : 0;
  });

  return distributions.sort((a, b) => b.usdValue - a.usdValue);
}

/**
 * Generate portfolio insights and recommendations
 */
function generatePortfolioInsights(
  aggregatedTokens: AggregatedToken[],
  chainDistribution: ChainAllocation[],
  totalValue: number
): PortfolioInsight[] {
  const insights: PortfolioInsight[] = [];

  // Concentration risk analysis
  const topToken = aggregatedTokens[0];
  if (topToken && topToken.portfolioPercentage > 80) {
    insights.push({
      type: 'concentration',
      severity: 'warning',
      title: 'High concentration risk',
      description: `${topToken.portfolioPercentage.toFixed(1)}% of portfolio in ${topToken.symbol}`,
      actionable: `Consider diversifying: /swap 0.1 ${topToken.symbol.toLowerCase()} for usdc`,
    });
  } else if (topToken && topToken.portfolioPercentage > 50) {
    insights.push({
      type: 'concentration',
      severity: 'info',
      title: 'Moderate concentration',
      description: `${topToken.portfolioPercentage.toFixed(1)}% of portfolio in ${topToken.symbol}`,
      actionable: `Consider some diversification for better risk management`,
    });
  }

  // Chain distribution analysis
  const dominantChain = chainDistribution[0];
  if (dominantChain && dominantChain.percentage > 90) {
    insights.push({
      type: 'chain-balance',
      severity: 'info',
      title: 'Single chain concentration',
      description: `${dominantChain.percentage.toFixed(1)}% on ${dominantChain.chainName}`,
      actionable: `Consider bridging assets to other chains for better diversification`,
    });
  }

  // Diversification analysis
  if (aggregatedTokens.length === 1) {
    insights.push({
      type: 'diversification',
      severity: 'warning',
      title: 'Single token portfolio',
      description: 'Portfolio consists of only one token type',
      actionable: `Consider diversifying: /swap some ${topToken?.symbol.toLowerCase()} for other assets`,
    });
  } else if (aggregatedTokens.length >= 5) {
    insights.push({
      type: 'diversification',
      severity: 'info',
      title: 'Well diversified',
      description: `Portfolio spread across ${aggregatedTokens.length} different tokens`,
    });
  }

  // Small portfolio opportunities
  if (totalValue < 100) {
    insights.push({
      type: 'opportunity',
      severity: 'info',
      title: 'Growing portfolio',
      description: `Total value: $${totalValue.toFixed(2)}`,
      actionable: 'Consider DCA strategies to grow your portfolio over time',
    });
  }

  // Stablecoin balance analysis
  const stablecoins = ['USDC', 'USDT', 'DAI', 'FRAX'];
  const stablecoinValue = aggregatedTokens
    .filter(token => stablecoins.includes(token.symbol.toUpperCase()))
    .reduce((sum, token) => sum + token.totalUsdValue, 0);

  const stablecoinPercentage = totalValue > 0 ? (stablecoinValue / totalValue) * 100 : 0;

  if (stablecoinPercentage < 5 && totalValue > 500) {
    insights.push({
      type: 'opportunity',
      severity: 'info',
      title: 'Low stablecoin reserves',
      description: `Only ${stablecoinPercentage.toFixed(1)}% in stablecoins`,
      actionable: 'Consider keeping some USDC for trading opportunities and gas fees',
    });
  }

  return insights;
}

/**
 * Create portfolio summary with aggregation and analysis
 */
export async function fetchPortfolioSummary(params: {
  address: `0x${string}`;
  chainIds?: number[];
  abortSignal?: AbortSignal;
}): Promise<PortfolioSummary> {
  // First get the raw portfolio data
  const snapshot = await fetchPortfolioSnapshot(params);

  // Aggregate tokens by symbol
  const aggregatedTokens = aggregateTokensBySymbol(snapshot.tokens);

  // Calculate total USD value from tokens with pricing
  const totalUsdValue = aggregatedTokens.reduce((sum, token) => sum + token.totalUsdValue, 0);

  // Calculate portfolio percentages
  aggregatedTokens.forEach(token => {
    token.portfolioPercentage = totalUsdValue > 0 ? (token.totalUsdValue / totalUsdValue) * 100 : 0;
  });

  // Sort by USD value descending
  aggregatedTokens.sort((a, b) => b.totalUsdValue - a.totalUsdValue);

  // Calculate chain distribution
  const chainDistribution = calculateChainDistribution(snapshot.tokens, totalUsdValue);

  // Generate insights
  const insights = generatePortfolioInsights(aggregatedTokens, chainDistribution, totalUsdValue);

  // Get unique chains count
  const activeChains = new Set(snapshot.tokens.map(token => token.chainId)).size;

  return {
    address: snapshot.address,
    fetchedAt: snapshot.fetchedAt,
    totalUsdValue,
    uniqueTokens: aggregatedTokens.length,
    totalPositions: snapshot.tokens.length,
    activeChains,
    topHoldings: aggregatedTokens.slice(0, 10), // Limit to top 10
    chainDistribution,
    insights,
    rawTokens: snapshot.tokens,
  };
}