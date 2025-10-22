'use client';

import clsx from 'clsx';
import { TbCoin } from 'react-icons/tb';

type CoinFlipHeaderProps = {
  historyOpen: boolean;
  toggleHistory: () => void;
  historyCount: number;
  headsCount: number;
  tailsCount: number;
  wins: number;
  losses: number;
  totalWagered: number;
  totalWinningPayout: number;
  totalProfit: number;
  formatEth: (value: number) => string;
};

export function CoinFlipHeader({
  historyOpen,
  toggleHistory,
  historyCount,
  headsCount,
  tailsCount,
  wins,
  losses,
  totalWagered,
  totalWinningPayout,
  totalProfit,
  formatEth,
}: CoinFlipHeaderProps) {
  return (
    <header className="border-b border-white/10 bg-slate-900/40 px-3 py-4 sm:px-5 lg:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 text-slate-200">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
            <TbCoin className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">CoinFlip</h1>
            <p className="text-xs text-slate-400">
              Practice probability with a simple on-chain inspired mini game.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleHistory}
            aria-pressed={historyOpen}
            className={clsx(
              'flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition',
              historyOpen
                ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                : 'border-white/10 bg-white/5 text-slate-200 hover:border-emerald-400/60 hover:text-emerald-200',
            )}
          >
            {historyOpen ? 'Play' : 'History'}
            <span className="rounded-full border border-white/10 bg-slate-950/60 px-2 py-[1px] text-[11px] text-slate-300">
              {historyCount}
            </span>
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 rounded-2xl border border-white/5 bg-slate-900/60 px-3 py-3 text-xs text-slate-300 sm:px-4">
        <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1">
          Heads {headsCount}
        </span>
        <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1">
          Tails {tailsCount}
        </span>
        <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1">
          Total {historyCount}
        </span>
        <span
          className={clsx(
            'rounded-full border px-3 py-1',
            wins
              ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
              : 'border-white/10 bg-slate-950/60 text-slate-300',
          )}
        >
          Wins {wins}
        </span>
        <span
          className={clsx(
            'rounded-full border px-3 py-1',
            losses
              ? 'border-rose-400/60 bg-rose-500/15 text-rose-200'
              : 'border-white/10 bg-slate-950/60 text-slate-300',
          )}
        >
          Losses {losses}
        </span>
        <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1">
          Wagered {formatEth(totalWagered)} ETH
        </span>
        <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1">
          Payout {formatEth(totalWinningPayout)} ETH
        </span>
        <span
          className={clsx(
            'rounded-full border px-3 py-1',
            totalProfit >= 0
              ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
              : 'border-rose-400/60 bg-rose-500/15 text-rose-200',
          )}
        >
          Net {totalProfit >= 0 ? '+' : '-'}
          {formatEth(Math.abs(totalProfit))} ETH
        </span>
      </div>
    </header>
  );
}
