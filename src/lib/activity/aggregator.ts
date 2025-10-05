// lib/activity/aggregator.ts - Aggregate activity from multiple sources

import { fetchTransactions, fetchTokenTransfers, transformBlockscoutTx } from './blockscout';
import type { OnChainActivity } from './types';
import type { AppState } from '@/cli/state/types';

/**
 * Fetch all on-chain activity for an address across all chains
 */
export async function fetchAllChainActivity(
  address: `0x${string}`,
  chainIds: number[],
  options?: {
    limit?: number; // Total results to return
    includeTokenTransfers?: boolean;
  }
): Promise<OnChainActivity[]> {
  const limit = options?.limit || 50;
  const perChainLimit = Math.ceil(limit / chainIds.length);

  // Fetch from all chains in parallel
  const chainPromises = chainIds.map(async (chainId) => {
    try {
      const [normalTxs, tokenTxs] = await Promise.all([
        fetchTransactions(chainId, address, { offset: perChainLimit }),
        options?.includeTokenTransfers
          ? fetchTokenTransfers(chainId, address, { offset: perChainLimit })
          : Promise.resolve([]),
      ]);

      // Transform normal transactions
      const activities = normalTxs.map((tx) =>
        transformBlockscoutTx(tx, address, chainId)
      );

      // TODO: Transform token transfers (similar to normal txs)
      // This requires merging token transfer data with the main tx

      return activities;
    } catch (error) {
      console.error(`Failed to fetch activity for chain ${chainId}:`, error);
      return [];
    }
  });

  const allActivities = (await Promise.all(chainPromises)).flat();

  // Sort by timestamp (newest first)
  allActivities.sort((a, b) => b.timestamp - a.timestamp);

  // Limit total results
  return allActivities.slice(0, limit);
}

/**
 * Merge on-chain activity with chat history
 * Deduplicates and prioritizes on-chain data
 */
export function mergeActivitySources(
  onChainActivities: OnChainActivity[],
  chatHistoryActivities: OnChainActivity[]
): OnChainActivity[] {
  // Create map of on-chain txs for O(1) lookup
  const onChainMap = new Map(
    onChainActivities.map(activity => [activity.txHash, activity])
  );

  // Filter chat history to only include txs NOT on-chain yet (pending)
  const pendingFromChat = chatHistoryActivities.filter(
    activity => !onChainMap.has(activity.txHash)
  );

  // Combine and sort
  const merged = [...onChainActivities, ...pendingFromChat];
  merged.sort((a, b) => b.timestamp - a.timestamp);

  return merged;
}

/**
 * Convert old chat history format to OnChainActivity
 * For backward compatibility
 */
export function convertChatHistoryToActivity(
  state: AppState,
  userAddress: `0x${string}`
): OnChainActivity[] {
  const history = [...state.chatHistory].reverse();
  const activities: OnChainActivity[] = [];

  for (let index = 0; index < history.length; index++) {
    const item = history[index];
    if (typeof item.content !== 'string') continue;

    const text = item.content.trim();
    if (!text) continue;

    const txHashMatch = text.match(/0x[a-fA-F0-9]{64}/);
    if (!txHashMatch) continue;

    const txHash = txHashMatch[0] as `0x${string}`;
    const status = inferStatusFromText(text, item.role);

    activities.push({
      id: `chat-${item.timestamp}-${index}`,
      txHash,
      chainId: state.core.chainId,
      type: 'unknown',
      status: status === 'success' ? 'app-initiated' : 'pending',
      timestamp: item.timestamp,
      blockNumber: 0,
      from: userAddress,
      to: '0x0000000000000000000000000000000000000000',
      isIncoming: false,
      value: {
        amount: '0',
        amountRaw: '0',
        symbol: 'ETH',
      },
      gas: {
        used: '0',
        price: '0',
        cost: '0',
      },
      description: text.split('\n')[0],
      explorerUrl: '',
      source: 'chat-history',
    });

    if (activities.length >= 12) break;
  }

  return activities;
}

function inferStatusFromText(text: string, role: 'user' | 'assistant'): 'success' | 'pending' | 'failed' {
  const normalized = text.toLowerCase();
  if (role === 'user') return 'pending';
  if (normalized.includes('success') || normalized.includes('🎉')) return 'success';
  if (normalized.includes('failed') || normalized.includes('error')) return 'failed';
  return 'pending';
}
