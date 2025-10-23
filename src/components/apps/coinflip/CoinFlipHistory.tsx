'use client';

import clsx from 'clsx';
import type { FlipHistoryEntry } from './types';
import { HISTORY_TABLE_HEADERS } from './constants';

type CoinFlipHistoryProps = {
  history: FlipHistoryEntry[];
  explorerBaseUrl: string | null;
  formatTimeAgo: (timestamp: number) => string;
  formatEth: (value: number) => string;
  formatMultiplier: (value: number) => string;
  shortenHash: (hash: string | null | undefined) => string | null;
  verifyLoading: boolean;
  onVerify: (entry: FlipHistoryEntry) => void;
};

export function CoinFlipHistory({
  history,
  explorerBaseUrl,
  formatTimeAgo,
  formatEth,
  formatMultiplier,
  shortenHash,
  verifyLoading,
  onVerify,
}: CoinFlipHistoryProps) {
  return (
    <section className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-3xl border border-emerald-500/20 bg-[#050d0b] shadow-[0_24px_60px_rgba(6,20,18,0.55)]">
      <div className="flex items-center justify-between border-b border-emerald-500/20 px-6 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-200">
          Game History
        </h2>
        <span className="text-[11px] text-emerald-200/70">
          {history.length ? 'Newest first' : 'No flips yet'}
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-emerald-500/40 scrollbar-track-transparent">
        {history.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 py-12 text-sm text-emerald-200/60">
            Flip the coin to start building a record.
          </div>
        ) : (
          <>
            <div className="hidden min-w-full px-4 py-4 md:block">
              <table className="min-w-full border-separate border-spacing-y-2 text-left text-xs">
                <thead>
                  <tr>
                    {HISTORY_TABLE_HEADERS.map((heading) => (
                      <th
                        key={heading}
                        className="bg-emerald-500/10 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-200/85 first:rounded-l-xl last:rounded-r-xl"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => {
                    const didWin = entry.payoutMultiplier > 0;
                    const payoutValue = entry.bet * entry.payoutMultiplier;
                    const txHash = entry.payoutTxHash ?? null;
                    const txUrl = txHash && explorerBaseUrl ? `${explorerBaseUrl}/tx/${txHash}` : null;
                    const sharedCellClasses = clsx(
                      'border border-white/5 px-3 py-3 text-xs transition-colors',
                      didWin
                        ? 'bg-emerald-500/10 text-emerald-100/90'
                        : 'bg-slate-950/75 text-slate-200/90',
                    );

                    return (
                      <tr key={`${entry.id}-${entry.timestamp}`}>
                        <td
                          className={clsx(
                            sharedCellClasses,
                            'rounded-l-xl font-mono text-[11px] text-emerald-200/80',
                          )}
                        >
                          {entry.id}
                        </td>
                        <td
                          className={clsx(sharedCellClasses, 'whitespace-nowrap text-emerald-300/75')}
                        >
                          {formatTimeAgo(entry.timestamp)}
                        </td>
                        <td className={sharedCellClasses}>
                          <span
                            className={clsx(
                              'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                              didWin
                                ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-200'
                                : 'border-rose-400/60 bg-rose-500/15 text-rose-200',
                            )}
                          >
                            {didWin ? 'Won' : 'Lost'}
                          </span>
                        </td>
                        <td className={sharedCellClasses}>{formatEth(entry.bet)} ETH</td>
                        <td className={sharedCellClasses}>{entry.result}</td>
                        <td className={sharedCellClasses}>x{formatMultiplier(entry.selectedMultiplier)}</td>
                        <td className={sharedCellClasses}>
                          {didWin ? `+${formatEth(payoutValue)} ETH` : `-${formatEth(entry.bet)} ETH`}
                        </td>
                        <td className={sharedCellClasses}>
                          {txUrl ? (
                            <a
                              href={txUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-300 underline-offset-2 hover:underline"
                            >
                              {shortenHash(txHash)}
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className={sharedCellClasses}>{entry.xp}</td>
                        <td className={sharedCellClasses}>{entry.result}</td>
                        <td className={clsx(sharedCellClasses, 'rounded-r-xl text-right')}>
                          <button
                            type="button"
                            onClick={() => onVerify(entry)}
                            disabled={verifyLoading}
                            className="rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Verify
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 px-4 py-4 md:hidden">
              {history.map((entry) => {
                const didWin = entry.payoutMultiplier > 0;
                const payoutValue = entry.bet * entry.payoutMultiplier;
                const txHash = entry.payoutTxHash ?? null;
                const txUrl = txHash && explorerBaseUrl ? `${explorerBaseUrl}/tx/${txHash}` : null;

                return (
                  <div
                    key={`${entry.id}-card`}
                    className={clsx(
                      'rounded-2xl border p-4',
                      didWin
                        ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-100'
                        : 'border-white/10 bg-slate-950/70 text-slate-200',
                    )}
                  >
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide">
                      <span className="font-mono text-[11px] text-emerald-200/80">#{entry.id}</span>
                      <span className="text-[10px] text-emerald-200/70">
                        {formatTimeAgo(entry.timestamp)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-semibold">{entry.result}</span>
                      <span
                        className={clsx(
                          'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                          didWin
                            ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-200'
                            : 'border-rose-400/60 bg-rose-500/15 text-rose-200',
                        )}
                      >
                        {didWin ? 'Won' : 'Lost'}
                      </span>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-slate-200">
                      <p>Guess {entry.guess}</p>
                      <p>Bet {formatEth(entry.bet)} ETH</p>
                      <p>Multiplier x{formatMultiplier(entry.selectedMultiplier)}</p>
                      <p>
                        Result{' '}
                        {didWin ? `+${formatEth(payoutValue)} ETH` : `-${formatEth(entry.bet)} ETH`}
                      </p>
                      <p>XP {entry.xp}</p>
                      {didWin && txUrl ? (
                        <p>
                          Payout Tx:{' '}
                          <a
                            href={txUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-300 underline-offset-2 hover:underline"
                          >
                            {shortenHash(txHash) ?? 'View'}
                          </a>
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                      <button
                        type="button"
                        onClick={() => onVerify(entry)}
                        disabled={verifyLoading}
                        className="rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Verify
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
