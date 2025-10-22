'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameHistoryItem, GameHistoryResponse, UserStatistics } from '@/types/game';
import { useEOA } from '../useEOA';
import useSmartWallet from '../useSmartWallet';

const DEFAULT_LIMIT = 20;

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

  stats: UserStatistics | null;
  isLoadingStats: boolean;
  statsError: string | null;
  fetchStats: () => Promise<void>;
  refetchStats: () => Promise<void>;
}

type PaginationState = {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

const emptyPagination: PaginationState = {
  total: 0,
  limit: DEFAULT_LIMIT,
  offset: 0,
  hasMore: false,
};

export function useGameHistory(addressOverride?: `0x${string}` | undefined): UseGameHistoryReturn {
  const { selectedWallet } = useEOA();
  const { smartAccountAddress } = useSmartWallet();

  const resolvedAddress = addressOverride ?? selectedWallet?.address ?? smartAccountAddress ?? undefined;
  const normalizedAddress = useMemo(
    () => (resolvedAddress ? (resolvedAddress.toLowerCase() as `0x${string}`) : undefined),
    [resolvedAddress],
  );

  const [history, setHistory] = useState<GameHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>(emptyPagination);

  const [stats, setStats] = useState<UserStatistics | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const paginationRef = useRef<PaginationState>(emptyPagination);
  const addressRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    paginationRef.current = pagination;
  }, [pagination]);

  const normalizeHistoryItems = (items: GameHistoryResponse['items']): GameHistoryItem[] =>
    items.map(item => ({
      ...item,
      date: item.date instanceof Date ? item.date : new Date(item.date),
    }));

  const setHistorySafely = useCallback((items: GameHistoryItem[]) => {
    setHistory(prev => {
      if (prev.length === items.length && prev.every((entry, index) => entry.id === items[index]?.id)) {
        return prev;
      }
      return items;
    });
  }, []);

  const setPaginationSafely = useCallback((next: PaginationState) => {
    setPagination(prev => {
      if (
        prev.total === next.total &&
        prev.limit === next.limit &&
        prev.offset === next.offset &&
        prev.hasMore === next.hasMore
      ) {
        return prev;
      }
      paginationRef.current = next;
      return next;
    });
  }, []);

  const fetchHistory = useCallback(
    async (params?: { limit?: number; offset?: number; status?: string }) => {
      if (!normalizedAddress) {
        setHistory(prev => (prev.length === 0 ? prev : []));
        setHistoryError('Wallet not connected');
        setPaginationSafely({ ...paginationRef.current, total: 0, offset: 0, hasMore: false });
        return;
      }

      const limit = typeof params?.limit === 'number' ? params.limit : paginationRef.current.limit;
      const offset = typeof params?.offset === 'number' ? params.offset : paginationRef.current.offset;

      setIsLoadingHistory(true);
      setHistoryError(null);

      try {
        const searchParams = new URLSearchParams({
          userAddress: normalizedAddress,
          limit: String(limit),
          offset: String(offset),
        });
        if (params?.status) {
          searchParams.set('status', params.status);
        }

        const response = await fetch(`/api/degenshoot/history?${searchParams.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch history: ${response.statusText}`);
        }

        const data: GameHistoryResponse = await response.json();
        setHistorySafely(normalizeHistoryItems(data.items));
        setPaginationSafely({
          total: data.pagination.total,
          limit: data.pagination.limit,
          offset: data.pagination.offset,
          hasMore: data.pagination.hasMore,
        });
      } catch (error) {
        console.error('Error fetching game history:', error);
        setHistorySafely([]);
        setHistoryError(error instanceof Error ? error.message : 'Failed to fetch history');
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [normalizedAddress, setHistorySafely, setPaginationSafely],
  );

  const refetchHistory = useCallback(async () => {
    const { limit, offset } = paginationRef.current;
    await fetchHistory({ limit, offset });
  }, [fetchHistory]);

  const fetchStats = useCallback(async () => {
    if (!normalizedAddress) {
      setStats(null);
      setStatsError('Wallet not connected');
      return;
    }

    setIsLoadingStats(true);
    setStatsError(null);

    try {
      const response = await fetch(`/api/degenshoot/stats?userAddress=${normalizedAddress}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.statusText}`);
      }

      const data: UserStatistics = await response.json();
      setStats(prev => {
        const unchanged =
          prev &&
          prev.totalWagered === data.totalWagered &&
          prev.gamesPlayed === data.gamesPlayed &&
          prev.gamesWon === data.gamesWon &&
          prev.gamesLost === data.gamesLost &&
          prev.winRate === data.winRate &&
          prev.totalPayout === data.totalPayout &&
          prev.netProfit === data.netProfit &&
          prev.avgMultiplier === data.avgMultiplier &&
          prev.maxMultiplier === data.maxMultiplier &&
          prev.highestPayout === data.highestPayout &&
          prev.longestStreak === data.longestStreak &&
          JSON.stringify(prev.onChain ?? null) === JSON.stringify(data.onChain ?? null);

        return unchanged ? prev : data;
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStats(null);
      setStatsError(error instanceof Error ? error.message : 'Failed to fetch stats');
    } finally {
      setIsLoadingStats(false);
    }
  }, [normalizedAddress]);

  const refetchStats = useCallback(async () => {
    await fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (addressRef.current === normalizedAddress) {
      return;
    }

    addressRef.current = normalizedAddress;

    if (!normalizedAddress) {
      setHistory([]);
      setStats(null);
      setPaginationSafely({ ...emptyPagination });
      setIsLoadingHistory(false);
      setIsLoadingStats(false);
      setHistoryError('Wallet not connected');
      setStatsError(null);
      return;
    }

    void fetchHistory({ limit: DEFAULT_LIMIT, offset: 0 });
    void fetchStats();
  }, [normalizedAddress, fetchHistory, fetchStats, setPaginationSafely]);

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
