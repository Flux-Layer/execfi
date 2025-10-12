// RPC Balance Fetcher - Direct blockchain balance queries for testnet support
import { createPublicClient, http, formatUnits, type Address } from 'viem';
import { getChainConfig } from '@/lib/chains/registry';
import type { PortfolioToken } from './portfolioService';

/**
 * RPC balance result
 */
export interface RpcBalance {
  chainId: number;
  balance: bigint;
  symbol: string;
  decimals: number;
}

/**
 * Configuration
 */
const RPC_TIMEOUT = 5000; // 5 seconds per chain
const MAX_RETRY_ATTEMPTS = 2;

/**
 * Validate chain has usable RPC URL
 */
export function validateChainRpcUrl(chainId: number): boolean {
  const config = getChainConfig(chainId);
  if (!config?.rpcUrl || config.rpcUrl === 'https://rpc.ankr.com/eth') {
    console.warn(`⚠️  Chain ${chainId} has invalid/fallback RPC URL`);
    return false;
  }
  return true;
}

/**
 * Fetch native token balance via direct RPC call
 * Used for testnet chains where LiFi SDK doesn't provide data
 * 
 * @param params.address - Wallet address
 * @param params.chainId - Chain ID to query
 * @param params.abortSignal - Optional abort signal
 * @returns Balance data or null if zero/error
 */
export async function fetchNativeBalance(params: {
  address: Address;
  chainId: number;
  abortSignal?: AbortSignal;
}): Promise<RpcBalance | null> {
  const { address, chainId, abortSignal } = params;
  
  try {
    const chainConfig = getChainConfig(chainId);
    if (!chainConfig) {
      console.warn(`⚠️  No config found for chain ${chainId}`);
      return null;
    }

    // Validate RPC URL
    if (!validateChainRpcUrl(chainId)) {
      return null;
    }

    // Create public client for RPC calls
    const client = createPublicClient({
      chain: chainConfig.wagmiChain,
      transport: http(chainConfig.rpcUrl, {
        timeout: RPC_TIMEOUT,
      }),
    });

    // Fetch balance with timeout
    const balance = await Promise.race([
      client.getBalance({ address }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('RPC timeout')), RPC_TIMEOUT)
      ),
    ]);

    // Skip if balance is zero
    if (balance === 0n) {
      return null;
    }

    return {
      chainId,
      balance,
      symbol: chainConfig.nativeCurrency.symbol,
      decimals: chainConfig.nativeCurrency.decimals,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to fetch balance on chain ${chainId}:`, errorMsg);
    return null;
  }
}

/**
 * Fetch native balance with retry logic
 */
async function fetchNativeBalanceWithRetry(params: {
  address: Address;
  chainId: number;
  abortSignal?: AbortSignal;
  attempt?: number;
}): Promise<RpcBalance | null> {
  const { attempt = 1, ...fetchParams } = params;
  
  try {
    return await fetchNativeBalance(fetchParams);
  } catch (error) {
    if (attempt < MAX_RETRY_ATTEMPTS) {
      console.warn(`🔄 Retry ${attempt}/${MAX_RETRY_ATTEMPTS} for chain ${params.chainId}`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      return fetchNativeBalanceWithRetry({ ...params, attempt: attempt + 1 });
    }
    console.error(`❌ Failed after ${MAX_RETRY_ATTEMPTS} attempts for chain ${params.chainId}`);
    return null;
  }
}

/**
 * Fetch native balances for multiple chains in parallel
 * 
 * @param params.address - Wallet address
 * @param params.chainIds - Array of chain IDs to query
 * @param params.abortSignal - Optional abort signal
 * @returns Array of balance results
 */
export async function fetchMultiChainNativeBalances(params: {
  address: Address;
  chainIds: number[];
  abortSignal?: AbortSignal;
}): Promise<RpcBalance[]> {
  const { address, chainIds, abortSignal } = params;

  // Filter chains with valid RPC URLs
  const validChainIds = chainIds.filter(validateChainRpcUrl);
  
  if (validChainIds.length < chainIds.length) {
    const invalidChains = chainIds.filter(id => !validChainIds.includes(id));
    console.warn(`⚠️  Skipping chains with invalid RPC: ${invalidChains.join(', ')}`);
  }

  if (validChainIds.length === 0) {
    console.warn('⚠️  No valid chains to query');
    return [];
  }

  console.log(`🔄 Fetching native balances via RPC for ${validChainIds.length} chains: ${validChainIds.join(', ')}`);

  // Fetch all chains in parallel with retry
  const results = await Promise.allSettled(
    validChainIds.map(chainId =>
      fetchNativeBalanceWithRetry({ address, chainId, abortSignal })
    )
  );

  // Filter successful results and non-null balances
  const balances = results
    .filter((result): result is PromiseFulfilledResult<NonNullable<RpcBalance>> => 
      result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value);

  console.log(`✅ Fetched ${balances.length} non-zero native balances via RPC`);

  return balances;
}

/**
 * Convert RPC balance to PortfolioToken format
 * 
 * @param params - RPC balance data
 * @returns PortfolioToken compatible object
 */
export function convertRpcBalanceToPortfolioToken(params: {
  chainId: number;
  balance: bigint;
  symbol: string;
  decimals: number;
  address: Address;
}): PortfolioToken {
  const { chainId, balance, symbol, decimals, address } = params;
  const chainConfig = getChainConfig(chainId);
  
  // Format balance using appropriate precision
  const formatted = formatUnits(balance, decimals);
  
  return {
    chainId,
    chainName: chainConfig?.name || `Chain ${chainId}`,
    symbol,
    name: chainConfig?.nativeCurrency.name || symbol,
    decimals,
    rawAmount: balance,
    formattedAmount: formatted,
    priceUsd: undefined, // No price data for testnets
    usdValue: 0, // No USD value without price
    address: '0x0000000000000000000000000000000000000000' as `0x${string}`, // Native token address
    logoURI: undefined,
  };
}
