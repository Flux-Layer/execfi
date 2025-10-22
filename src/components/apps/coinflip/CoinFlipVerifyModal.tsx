'use client';

import clsx from 'clsx';
import { SeedRow } from './SeedRow';
import type { RevealInfo, VerifySubject } from './types';

type CoinFlipVerifyModalProps = {
  open: boolean;
  verifyError: string | null;
  revealInfo: RevealInfo | null;
  verifySubject: VerifySubject | null;
  onClose: () => void;
};

export function CoinFlipVerifyModal({
  open,
  verifyError,
  revealInfo,
  verifySubject,
  onClose,
}: CoinFlipVerifyModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center pointer-events-auto justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold	text-slate-100">Verify Fairness</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-300 transition hover:border-emerald-400/60 hover:text-emerald-200"
          >
            Close
          </button>
        </div>
        <div className="mt-4 space-y-3 text-left text-sm text-slate-200">
          {verifyError ? (
            <p className="rounded-xl border border-rose-400/50 bg-rose-500/10 px-3 py-2 text-rose-200">
              {verifyError}
            </p>
          ) : revealInfo ? (
            <>
              <p className="text-xs text-slate-300">
                Seeds below let anyone recompute the outcome by hashing
                <code className="mx-1 rounded bg-slate-900/60 px-1">serverSeed + clientSeed</code>
                and checking parity. The vault already settled using this result.
              </p>
              <SeedRow label="Server Seed Hash" value={revealInfo.serverSeedHash} />
              <SeedRow label="Server Seed" value={revealInfo.serverSeed} />
              <SeedRow label="Client Seed" value={revealInfo.clientSeed} />
              <p
                className={clsx(
                  'rounded-xl border px-3 py-2 text-center text-sm font-medium',
                  verifySubject && revealInfo.outcome === verifySubject.outcome
                    ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                    : 'border-rose-400/50 bg-rose-500/15 text-rose-200',
                )}
              >
                Verified outcome: {revealInfo.outcome}
                {verifySubject &&
                  (revealInfo.outcome === verifySubject.outcome
                    ? ' · Matches recorded result'
                    : ' · Does not match recorded result')}
              </p>
            </>
          ) : (
            <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
              No reveal data available yet. Flip a coin and submit the result to generate seeds.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
