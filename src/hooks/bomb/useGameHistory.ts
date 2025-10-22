import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import type { GameHistoryItem, GameHistoryResponse, UserStatistics } from '@/types/game';

interface UseGameHistoryReturn {
  history: GameHistoryItem[];
  isLoadingHistory: boolean;
  historyError: string | null;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  fetchHistory: (params?: { limit?: number; offset?: number; status?: string }) => Promise<void>;
  refetchHistory: () => Promise<void>;

  // Stats
  stats: UserStatistics | null;
  isLoadingStats: boolean;
  statsError: string | null;
  fetchStats: () => Promise<void>;
  refetchStats: () => Promise<void>;
}

export function useGameHistory(): UseGameHistoryReturn {
  const { address } = useAccount();

  // History state
  const [history, setHistory] = useState<GameHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false,
  });

  // Stats state
  const [stats, setStats] = useState<UserStatistics | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }) => {
    if (!address) {
      setHistory([]);
      setHistoryError('Wallet not connected');
      return;
    }

    setIsLoadingHistory(true);
    setHistoryError(null);

    try {
      const queryParams = new URLSearchParams({
        userAddress: address,
        limit: String(params?.limit ?? pagination.limit),
        offset: String(params?.offset ?? pagination.offset),
        ...(params?.status && { status: params.status }),
      });

      const response = await fetch(`/api/degenshoot/history?${queryParams}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.statusText}`);
      }

      const data: GameHistoryResponse = await response.json();

      setHistory(data.items);
      setPagination({
        total: data.pagination.total,
        limit: data.pagination.limit,
        offset: data.pagination.offset,
        hasMore: data.pagination.hasMore,
      });
    } catch (error) {
      console.error('Error fetching game history:', error);
      setHistoryError(error instanceof Error ? error.message : 'Failed to fetch history');
      setHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [address, pagination.limit, pagination.offset]);

  const refetchHistory = useCallback(async () => {
    await fetchHistory({ limit: pagination.limit, offset: pagination.offset });
  }, [fetchHistory, pagination.limit, pagination.offset]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!address) {
      setStats(null);
      setStatsError('Wallet not connected');
      return;
    }

    setIsLoadingStats(true);
    setStatsError(null);

    try {
      const response = await fetch(`/api/degenshoot/stats?userAddress=${address}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.statusText}`);
      }

      const data: UserStatistics = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStatsError(error instanceof Error ? error.message : 'Failed to fetch stats');
      setStats(null);
    } finally {
      setIsLoadingStats(false);
    }
  }, [address]);

  const refetchStats = useCallback(async () => {
    await fetchStats();
  }, [fetchStats]);

  // Auto-fetch history and stats when address changes
  useEffect(() => {
    if (address) {
      fetchHistory({ limit: 20, offset: 0 });
      fetchStats();
    } else {
      setHistory([]);
      setPagination({ total: 0, limit: 20, offset: 0, hasMore: false });
      setStats(null);
    }
  }, [address]); // Only depend on address to avoid infinite loops

  return {
    history,
    isLoadingHistory,
    historyError,
    pagination,
    fetchHistory,
    refetchHistory,

    stats,
    isLoadingStats,
    statsError,
    fetchStats,
    refetchStats,
  };
}
