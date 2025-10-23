'use client';

import { useState } from 'react';
import type { GameHistoryItem } from '@/types/game';

interface BombHistoryCardProps {
  item: GameHistoryItem;
  onVerifyClick: (sessionId: string) => void;
}

// Simple time ago formatter (same as in BombHistoryTable)
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

export function BombHistoryCard({
  item,
  onVerifyClick,
}: BombHistoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <ResultBadge result={item.result} />
            <span className="text-sm font-medium text-gray-300">
              {item.multiplier.toFixed(2)}x
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {formatTimeAgo(item.date)}
          </p>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-400 hover:text-gray-200"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <svg
            className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Summary */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-400">Bet Amount</p>
          <p className="mt-1 font-mono text-sm text-gray-200">{item.betAmount} ETH</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Rows Cleared</p>
          <p className="mt-1 text-sm text-gray-200">{item.rows}</p>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 space-y-3 border-t border-gray-700 pt-4">
          <div>
            <p className="text-xs text-gray-400">Status</p>
            <div className="mt-1">
              <StatusBadge status={item.status} />
            </div>
          </div>

          {item.withdrawTxHash && item.result === 'win' && (
            <div>
              <p className="text-xs text-gray-400">Cashout Transaction</p>
              <a
                href={`https://sepolia.basescan.org/tx/${item.withdrawTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block truncate font-mono text-xs text-blue-400 hover:underline"
              >
                {item.withdrawTxHash}
              </a>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-400">Server Seed Hash</p>
            <p className="mt-1 truncate font-mono text-xs text-gray-300">
              {item.serverSeedHash}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {item.canVerify && (
              <button
                onClick={() => onVerifyClick(item.id)}
                className={`flex-1 rounded px-4 py-2 text-sm font-medium text-white ${
                  item.isVerified
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {item.isVerified ? '✓ Verified' : 'Verify'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Reuse badge components from BombHistoryTable
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

function ResultBadge({ result }: { result: 'win' | 'loss' | 'active' }) {
  const config = {
    win: { label: '✓ Win', className: 'bg-green-900/20 text-green-400' },
    loss: { label: '✗ Loss', className: 'bg-red-900/20 text-red-400' },
    active: { label: '● Active', className: 'bg-gray-900/20 text-gray-400' },
  };

  const { label, className } = config[result];

  return (
    <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
