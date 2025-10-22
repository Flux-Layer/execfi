'use client';

import type { GameHistoryItem } from '@/types/game';

interface BombHistoryTableProps {
  items: GameHistoryItem[];
  onVerifyClick: (sessionId: string) => void;
  onDetailsClick: (sessionId: string) => void;
}

// Simple time ago formatter
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function BombHistoryTable({
  items,
  onVerifyClick,
  onDetailsClick,
}: BombHistoryTableProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <p className="text-lg">No game history found</p>
        <p className="mt-2 text-sm">Start playing to see your history here!</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-gray-700 bg-gray-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-400">
              Bet
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
              Result
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-400">
              Multiplier
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-400">
              Rows
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {items.map(item => (
            <tr key={item.id} className="hover:bg-gray-800/50">
              <td className="px-4 py-3 text-sm text-gray-300">
                {formatTimeAgo(item.date)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={item.status} />
              </td>
              <td className="px-4 py-3 text-right font-mono text-sm text-gray-300">
                {item.betAmount} ETH
              </td>
              <td className="px-4 py-3">
                <ResultBadge result={item.result} />
              </td>
              <td className="px-4 py-3 text-right font-mono text-sm text-gray-300">
                {item.multiplier.toFixed(2)}x
              </td>
              <td className="px-4 py-3 text-right text-sm text-gray-300">
                {item.rows}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-center gap-2">
                  {item.canVerify && (
                    <button
                      onClick={() => onVerifyClick(item.id)}
                      className={`rounded px-3 py-1 text-xs font-medium text-white ${
                        item.isVerified
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {item.isVerified ? '✓ Verified' : 'Verify'}
                    </button>
                  )}
                  <button
                    onClick={() => onDetailsClick(item.id)}
                    className="rounded bg-gray-700 px-3 py-1 text-xs font-medium text-white hover:bg-gray-600"
                  >
                    Details
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const colors = {
    active: 'bg-yellow-900/20 text-yellow-400 border-yellow-500/30',
    completed: 'bg-green-900/20 text-green-400 border-green-500/30',
    lost: 'bg-red-900/20 text-red-400 border-red-500/30',
    revealed: 'bg-blue-900/20 text-blue-400 border-blue-500/30',
    submitted: 'bg-purple-900/20 text-purple-400 border-purple-500/30',
  };

  const colorClass = colors[status as keyof typeof colors] || colors.active;

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${colorClass}`}>
      {status}
    </span>
  );
}

// Result Badge Component
function ResultBadge({ result }: { result: 'win' | 'loss' | 'active' }) {
  const config = {
    win: { label: 'Win', className: 'bg-green-900/20 text-green-400' },
    loss: { label: 'Loss', className: 'bg-red-900/20 text-red-400' },
    active: { label: 'Active', className: 'bg-gray-900/20 text-gray-400' },
  };

  const { label, className } = config[result];

  return (
    <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
