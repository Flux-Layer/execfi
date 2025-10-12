// hooks/useOnChainActivity.ts - React hook for fetching on-chain activity

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllChainActivity } from '@/lib/activity/aggregator';
import type { OnChainActivity } from '@/lib/activity/types';

export interface UseOnChainActivityOptions {
  address?: `0x${string}`;
  chainIds: number[];
  enabled?: boolean;
  refreshInterval?: number; // Auto-refresh interval (ms)
  limit?: number;
}

export function useOnChainActivity(options: UseOnChainActivityOptions) {
  const { address, chainIds, enabled = true, refreshInterval, limit = 50 } = options;

  const [activities, setActivities] = useState<OnChainActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Use ref to track if we've already fetched to prevent infinite loops
  const hasFetched = useRef(false);
  // Stable reference to chainIds to prevent re-renders
  const chainIdsString = JSON.stringify(chainIds);

  const fetchActivities = useCallback(async () => {
    if (!address || !enabled) return;

    setLoading(true);
    setError(null);

    try {
      const data = await fetchAllChainActivity(address, chainIds, {
        limit,
        includeTokenTransfers: true,
      });
      setActivities(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [address, chainIdsString, enabled, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial fetch - only once when enabled and address changes
  useEffect(() => {
    if (!address || !enabled) {
      hasFetched.current = false;
      return;
    }

    // Only fetch if we haven't fetched yet for this address
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchActivities();
    }
  }, [address, enabled, chainIdsString]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh interval (optional)
  useEffect(() => {
    if (!refreshInterval || !address || !enabled) return;

    const interval = setInterval(() => {
      fetchActivities();
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [refreshInterval, address, enabled, chainIdsString]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual refetch function
  const refetch = useCallback(() => {
    hasFetched.current = true;
    fetchActivities();
  }, [fetchActivities]);

  return {
    activities,
    loading,
    error,
    refetch,
  };
}
