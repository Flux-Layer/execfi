'use client';

import clsx from 'clsx';

export type OutcomePopupState = {
  win: boolean;
  message: string;
  xp: number;
  payoutText?: string;
  cashoutHash?: string;
};

type CoinFlipOutcomePopupProps = {
  outcomePopup: OutcomePopupState | null;
  onClose: () => void;
  disabled?: boolean;
};

export function CoinFlipOutcomePopup({ outcomePopup, onClose, disabled }: CoinFlipOutcomePopupProps) {
  if (!outcomePopup || disabled) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60 backdrop-blur">
      <div
        className={clsx(
          'mx-4 w-full max-w-xs rounded-2xl border px-5 py-6 text-center shadow-2xl transition',
          outcomePopup.win
            ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'
            : 'border-rose-400/60 bg-rose-500/15 text-rose-100',
        )}
      >
        <p className="text-lg font-semibold uppercase tracking-widest">
          {outcomePopup.win ? 'Win' : 'Lose'}
        </p>
        <p className="mt-2 text-sm text-slate-100">{outcomePopup.message}</p>
        <p className="mt-3 text-xs text-slate-200">XP +{outcomePopup.xp}</p>
        {outcomePopup.payoutText ? (
          <p
            className={clsx(
              'mt-1 text-xs font-medium',
              outcomePopup.win ? 'text-emerald-100' : 'text-slate-200',
            )}
          >
            {outcomePopup.payoutText}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="mt-5 rounded-full border border-white/20 bg-slate-950/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-white/40 hover:text-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}
