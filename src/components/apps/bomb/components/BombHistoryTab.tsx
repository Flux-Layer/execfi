'use client';

import { useGameHistory } from '@/hooks/bomb/useGameHistory';
import { BombHistoryTable } from './BombHistoryTable';
import { BombHistoryCard } from './BombHistoryCard';
import { BombPagination } from './BombPagination';

interface BombHistoryTabProps {
  onVerifyClick: (sessionId: string) => void;
  onDetailsClick: (sessionId: string) => void;
}

export function BombHistoryTab({
  onVerifyClick,
  onDetailsClick,
}: BombHistoryTabProps) {
  const {
    history,
    isLoadingHistory,
    historyError,
    pagination,
    fetchHistory,
  } = useGameHistory();

  const handlePageChange = (newOffset: number) => {
    fetchHistory({ limit: pagination.limit, offset: newOffset });
  };

  const handleLimitChange = (newLimit: number) => {
    fetchHistory({ limit: newLimit, offset: 0 });
  };

  if (isLoadingHistory) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-green-500 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-400">Loading history...</p>
        </div>
      </div>
    );
  }

  if (historyError) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-red-400">Error loading history</p>
          <p className="mt-2 text-sm text-gray-400">{historyError}</p>
          <button
            onClick={() => fetchHistory()}
            className="mt-4 rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Desktop Table View */}
      <div className="hidden md:block">
        <BombHistoryTable
          items={history}
          onVerifyClick={onVerifyClick}
          onDetailsClick={onDetailsClick}
        />
      </div>

      {/* Mobile Card View */}
      <div className="block md:hidden space-y-4 p-4">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <p className="text-lg">No game history found</p>
            <p className="mt-2 text-sm">Start playing to see your history here!</p>
          </div>
        ) : (
          history.map(item => (
            <BombHistoryCard
              key={item.id}
              item={item}
              onVerifyClick={onVerifyClick}
              onDetailsClick={onDetailsClick}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.total > 0 && (
        <BombPagination
          total={pagination.total}
          limit={pagination.limit}
          offset={pagination.offset}
          hasMore={pagination.hasMore}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
        />
      )}
    </div>
  );
}
