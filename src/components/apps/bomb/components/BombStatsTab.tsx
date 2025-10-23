'use client';

import { useGameHistory } from '@/hooks/bomb/useGameHistory';
import { BombStatCard } from './BombStatCard';

interface BombStatsTabProps {
  activeAddress?: `0x${string}` | undefined;
}

export function BombStatsTab({ activeAddress }: BombStatsTabProps) {
  const { stats, isLoadingStats, statsError, fetchStats } = useGameHistory(activeAddress);

  if (statsError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-red-400">
        <p className="text-lg">Error loading statistics</p>
        <p className="mt-2 text-sm">{statsError}</p>
        <button
          onClick={fetchStats}
          className="mt-4 rounded bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Overview Section */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-200">Overview</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <BombStatCard
            icon="💰"
            label="Total Wagered"
            value={stats?.totalWagered || '0'}
            subvalue="ETH"
            isLoading={isLoadingStats}
          />
          <BombStatCard
            icon="🎮"
            label="Games Played"
            value={stats?.gamesPlayed || 0}
            isLoading={isLoadingStats}
          />
          <BombStatCard
            icon="📈"
            label="Net Profit"
            value={stats?.netProfit || '0'}
            subvalue="ETH"
            trend={
              stats && parseFloat(stats.netProfit) > 0 ? 'up' :
              stats && parseFloat(stats.netProfit) < 0 ? 'down' :
              'neutral'
            }
            isLoading={isLoadingStats}
          />
        </div>
      </section>

      {/* Performance Section */}
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-200">Performance</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <BombStatCard
            icon="🏆"
            label="Games Won"
            value={stats?.gamesWon || 0}
            isLoading={isLoadingStats}
          />
          <BombStatCard
            icon="💔"
            label="Games Lost"
            value={stats?.gamesLost || 0}
            isLoading={isLoadingStats}
          />
          <BombStatCard
            icon="📊"
            label="Win Rate"
            value={stats ? `${stats.winRate.toFixed(1)}%` : '0%'}
            isLoading={isLoadingStats}
          />
          <BombStatCard
            icon="🔥"
            label="Longest Streak"
            value={stats?.longestStreak || 0}
            subvalue="consecutive wins"
            isLoading={isLoadingStats}
          />
        </div>
      </section>

      {/* Multipliers Section */}
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-200">Multipliers</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <BombStatCard
            icon="📐"
            label="Average Multiplier"
            value={stats ? `${stats.avgMultiplier.toFixed(2)}x` : '0x'}
            isLoading={isLoadingStats}
          />
          <BombStatCard
            icon="🚀"
            label="Max Multiplier"
            value={stats ? `${stats.maxMultiplier.toFixed(2)}x` : '0x'}
            isLoading={isLoadingStats}
          />
          <BombStatCard
            icon="💎"
            label="Highest Payout"
            value={stats?.highestPayout || '0'}
            subvalue="ETH"
            isLoading={isLoadingStats}
          />
        </div>
      </section>

      {/* On-Chain Data Section (if available) */}
      {stats?.onChain && (
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-200">
            On-Chain Verified
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <BombStatCard
              icon="⛓️"
              label="On-Chain Wagered"
              value={stats.onChain.totalWagered}
              subvalue="ETH"
              isLoading={isLoadingStats}
            />
            <BombStatCard
              icon="✅"
              label="Settled Wagers"
              value={stats.onChain.settledWagerCount}
              isLoading={isLoadingStats}
            />
            <BombStatCard
              icon="💸"
              label="Net Winnings"
              value={stats.onChain.totalNetWinnings}
              subvalue="ETH"
              isLoading={isLoadingStats}
            />
          </div>
        </section>
      )}
    </div>
  );
}
