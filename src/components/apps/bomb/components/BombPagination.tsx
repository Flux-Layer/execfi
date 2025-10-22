'use client';

interface BombPaginationProps {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  onPageChange: (offset: number) => void;
  onLimitChange: (limit: number) => void;
}

export function BombPagination({
  total,
  limit,
  offset,
  hasMore,
  onPageChange,
  onLimitChange,
}: BombPaginationProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  const canGoPrev = offset > 0;
  const canGoNext = hasMore;

  const handlePrev = () => {
    if (canGoPrev) {
      onPageChange(Math.max(0, offset - limit));
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      onPageChange(offset + limit);
    }
  };

  const handleFirst = () => {
    onPageChange(0);
  };

  const handleLast = () => {
    onPageChange((totalPages - 1) * limit);
  };

  return (
    <div className="flex flex-col items-center justify-between gap-4 border-t border-gray-700 bg-gray-800 px-4 py-3 sm:flex-row">
      {/* Items per page */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">Show:</span>
        <select
          value={limit}
          onChange={e => onLimitChange(Number(e.target.value))}
          className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-gray-200"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <span className="text-sm text-gray-400">per page</span>
      </div>

      {/* Page info */}
      <div className="text-sm text-gray-400">
        Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} games
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleFirst}
          disabled={!canGoPrev}
          className="rounded px-3 py-1 text-sm font-medium text-gray-400 hover:bg-gray-700 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="First page"
        >
          ««
        </button>
        <button
          onClick={handlePrev}
          disabled={!canGoPrev}
          className="rounded px-3 py-1 text-sm font-medium text-gray-400 hover:bg-gray-700 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          «
        </button>
        <span className="px-3 py-1 text-sm text-gray-300">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={handleNext}
          disabled={!canGoNext}
          className="rounded px-3 py-1 text-sm font-medium text-gray-400 hover:bg-gray-700 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          »
        </button>
        <button
          onClick={handleLast}
          disabled={!canGoNext}
          className="rounded px-3 py-1 text-sm font-medium text-gray-400 hover:bg-gray-700 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Last page"
        >
          »»
        </button>
      </div>
    </div>
  );
}
